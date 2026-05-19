<?php
/**
 * ProcureFlow — Purchase Approval System Installer
 * Multi-step setup wizard: Requirements → DB → Admin → Organization → SMTP → Install
 * DELETE this file after setup is complete.
 */
session_start();

// ── Helpers ───────────────────────────────────────────────────────────────────
function env_write(array $data): bool {
    $lines = [];
    foreach ($data as $k => $v) $lines[] = "$k=" . $v;
    return file_put_contents(__DIR__ . '/.env', implode("\n", $lines) . "\n") !== false;
}

function req_checks(): array {
    return [
        ['PHP ≥ 8.1',               version_compare(PHP_VERSION, '8.1.0', '>='), PHP_VERSION],
        ['ext-mongodb installed',    extension_loaded('mongodb'),                 extension_loaded('mongodb') ? 'OK' : 'Run: pecl install mongodb'],
        ['Composer autoload exists', file_exists(__DIR__ . '/vendor/autoload.php'), file_exists(__DIR__ . '/vendor/autoload.php') ? 'OK' : 'Run: composer install'],
        ['.env writable (folder)',   is_writable(__DIR__),                        is_writable(__DIR__) ? 'OK' : 'chmod 755 ' . __DIR__],
        ['uploads/ writable',        is_writable(__DIR__ . '/uploads') || @mkdir(__DIR__ . '/uploads', 0755, true), 'OK'],
    ];
}

function test_mongo(string $uri, string $db): array {
    try {
        if (!extension_loaded('mongodb')) throw new Exception('MongoDB extension not loaded');
        require_once __DIR__ . '/vendor/autoload.php';
        $client = new MongoDB\Client($uri, [], ['serverSelectionTimeoutMS' => 3000]);
        $client->$db->command(['ping' => 1]);
        return ['ok' => true, 'msg' => 'Connection successful'];
    } catch (Throwable $e) {
        return ['ok' => false, 'msg' => $e->getMessage()];
    }
}


// ── Step routing ─────────────────────────────────────────────────────────────
$step              = $_POST['step'] ?? ($_GET['step'] ?? 'requirements');
$errors            = [];
$info              = [];
$createdAdminEmail = null;

// Store form data in session across steps
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    foreach ($_POST as $k => $v) {
        if ($k !== 'step') $_SESSION['install'][$k] = trim($v);
    }
}
$d = &$_SESSION['install'];
$d = $d ?? [];

// ── Action: Test MongoDB ──────────────────────────────────────────────────────
if ($step === 'test_mongo') {
    header('Content-Type: application/json');
    echo json_encode(test_mongo($d['mongo_uri'] ?? 'mongodb://localhost:27017', $d['mongo_db'] ?? 'purchase_approval'));
    exit;
}


// ── Step: Advance requirements check ─────────────────────────────────────────
if ($step === 'step2' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $checks = req_checks();
    $allOk  = array_reduce($checks, fn($c, $i) => $c && $i[1], true);
    if (!$allOk) { $step = 'requirements'; $errors[] = 'Fix all failing requirements before continuing.'; }
}

// ── Step: Validate admin credentials before proceeding ───────────────────────
if ($step === 'step4' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $EMAIL_RE = '/^[^\s@]+@[^\s@]+\.[^\s@]+$/';
    $adminName  = trim($_POST['admin_name']  ?? '');
    $adminEmail = trim($_POST['admin_email'] ?? '');
    $adminPass  = $_POST['admin_password']   ?? '';
    $adminConf  = $_POST['admin_confirm']    ?? '';
    if (!$adminName || !$adminEmail || !$adminPass) {
        $errors[] = 'All admin fields are required.';
        $step = 'step3b';
    } elseif (!preg_match($EMAIL_RE, $adminEmail)) {
        $errors[] = 'Enter a valid email address for the admin account.';
        $step = 'step3b';
    } elseif (strlen($adminPass) < 8) {
        $errors[] = 'Admin password must be at least 8 characters.';
        $step = 'step3b';
    } elseif ($adminPass !== $adminConf) {
        $errors[] = 'Passwords do not match.';
        $step = 'step3b';
    } else {
        $_SESSION['install']['admin_name']  = $adminName;
        $_SESSION['install']['admin_email'] = strtolower($adminEmail);
        $_SESSION['install']['admin_hash']  = password_hash($adminPass, PASSWORD_BCRYPT, ['cost' => 12]);
        $step = 'step4b'; // advance to organization step
    }
}

// ── Step: Install & Write .env ────────────────────────────────────────────────
if ($step === 'install' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $envData = [
        'MONGO_URI'  => $d['mongo_uri']  ?? 'mongodb://localhost:27017',
        'MONGO_DB'   => $d['mongo_db']   ?? 'purchase_approval',
        'JWT_SECRET' => $d['jwt_secret'] ?? bin2hex(random_bytes(32)),
        'APP_URL'    => rtrim($d['app_url'] ?? '', '/'),
    ];
    if (!isset($d['admin_hash']) || !$d['admin_hash']) {
        $errors[] = 'Admin account was not configured. Go back to Step 3.';
        $step = 'step5';
    } elseif (!env_write($envData)) {
        $errors[] = 'Cannot write .env file — check folder permissions.';
        $step = 'step5';
    } else {
        $info[] = '.env file written successfully.';
        foreach ($envData as $k => $v) putenv("$k=$v");
        try {
            require_once __DIR__ . '/vendor/autoload.php';
            require_once __DIR__ . '/includes/config.php';
            require_once __DIR__ . '/includes/auth.php';
            ob_start();
            require_once __DIR__ . '/includes/seed.php';
            ob_end_clean();
            $info[] = 'Database seeded (approval levels, indexes).';

            // Create company if org name was provided
            $orgName = trim($d['org_name'] ?? '');
            if ($orgName) {
                db()->companies->insertOne([
                    '_id'        => new_id(),
                    'name'       => $orgName,
                    'email'      => $d['org_email'] ?? '',
                    'phone'      => $d['org_phone'] ?? '',
                    'logo'       => null,
                    'is_active'  => true,
                    'created_at' => now_iso(),
                ]);
                $info[] = 'Organization created: ' . htmlspecialchars($orgName);
            }

            // Create the super admin account
            $adminDoc = [
                '_id'        => new_id(),
                'name'       => $d['admin_name'],
                'email'      => $d['admin_email'],
                'role'       => 'admin',
                'department' => 'Management',
                'is_active'  => true,
                'password'   => $d['admin_hash'],
                'created_at' => now_iso(),
            ];
            db()->users->insertOne($adminDoc);
            $createdAdminEmail = $d['admin_email'];
            $info[] = 'Super admin account created: ' . htmlspecialchars($createdAdminEmail);
            $step = 'done';
            session_destroy();
        } catch (Throwable $e) {
            $errors[] = 'Installation error: ' . htmlspecialchars($e->getMessage());
            $step = 'step5';
        }
    }
}

// ── Populate defaults ─────────────────────────────────────────────────────────
$d['mongo_uri']  = $d['mongo_uri']  ?? (getenv('MONGO_URI') ?: 'mongodb://localhost:27017');
$d['mongo_db']   = $d['mongo_db']   ?? 'purchase_approval';
$d['jwt_secret'] = $d['jwt_secret'] ?? bin2hex(random_bytes(32));
$d['app_url']    = $d['app_url']    ?? 'https://' . ($_SERVER['HTTP_HOST'] ?? 'yourdomain.com');

$checks  = req_checks();
$allPass = array_reduce($checks, fn($c, $i) => $c && $i[1], true);

$STEPS = [
    'requirements' => ['num' => 1, 'label' => 'Requirements'],
    'step2'        => ['num' => 2, 'label' => 'Database & App'],
    'step3b'       => ['num' => 3, 'label' => 'Admin Account'],
    'step4'        => ['num' => 3, 'label' => 'Admin Account'],
    'step4b'       => ['num' => 4, 'label' => 'Organization'],
    'install'      => ['num' => 5, 'label' => 'Install'],
    'done'         => ['num' => 5, 'label' => 'Install'],
];
$currentNum = $STEPS[$step]['num'] ?? 1;
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ProcureFlow — System Setup</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Inter',sans-serif;background:#fefce8;min-height:100vh;padding:2rem 1rem}

    /* Layout */
    .page{display:flex;gap:2rem;max-width:980px;margin:0 auto;align-items:flex-start}
    .sidebar{width:220px;flex-shrink:0;position:sticky;top:2rem}
    .main{flex:1;min-width:0}

    /* Sidebar brand */
    .brand{background:linear-gradient(135deg,#ec4899,#f472b6);border-radius:16px;padding:1.5rem;color:#fefce8;margin-bottom:1.25rem;text-align:center}
    .brand .mark{width:52px;height:52px;background:rgba(255,255,255,.2);border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:1.4rem;font-weight:900;color:#fefce8;margin:0 auto .75rem}
    .brand .company{font-size:.85rem;font-weight:800;color:#fefce8}
    .brand .sub{font-size:.7rem;color:#fce7f3;margin-top:.2rem}

    /* Steps nav */
    .steps-nav{background:#fdf4f7;border:1px solid #fbcfe8;border-radius:12px;padding:1rem;display:flex;flex-direction:column;gap:.25rem}
    .step-item{display:flex;align-items:center;gap:.625rem;padding:.5rem .625rem;border-radius:8px;font-size:.8rem;font-weight:600;color:#94a3b8;transition:all .15s}
    .step-item.active{background:#fce7f3;color:#ec4899}
    .step-item.done{color:#15803d}
    .step-item .num{width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.7rem;font-weight:800;background:#f1f5f9;flex-shrink:0}
    .step-item.active .num{background:#ec4899;color:#fefce8}
    .step-item.done .num{background:#d1fae5;color:#15803d}

    /* Card */
    .card{background:#fdf4f7;border:1px solid #fbcfe8;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(236,72,153,.07)}
    .card-header{padding:1.75rem 2rem 1.25rem;border-bottom:1px solid #fce7f3;display:flex;align-items:center;gap:1rem}
    .card-header .icon{width:44px;height:44px;background:#fce7f3;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:1.25rem;flex-shrink:0}
    .card-header h2{font-size:1.1rem;font-weight:800;color:#831843}
    .card-header p{font-size:.8rem;color:#6b7280;margin-top:.2rem}
    .card-body{padding:1.75rem 2rem}

    /* Checks */
    .check-row{display:flex;align-items:center;gap:.75rem;padding:.625rem .875rem;border-radius:.625rem;margin-bottom:.375rem;font-size:.85rem}
    .check-row.pass{background:#f0fdf4;color:#065f46}
    .check-row.fail{background:#fef2f2;color:#991b1b}
    .check-detail{font-size:.75rem;margin-left:auto;opacity:.8;font-family:monospace}

    /* Form */
    .field{margin-bottom:1.25rem}
    .field label{display:block;font-size:.8rem;font-weight:700;color:#374151;margin-bottom:.4rem}
    .field label .hint{font-weight:400;color:#94a3b8;margin-left:.375rem}
    .field input,.field select{width:100%;border:1.5px solid #fbcfe8;border-radius:.625rem;padding:.65rem .875rem;font-size:.875rem;font-family:inherit;transition:border-color .15s;background:#fefce8;color:#111827}
    .field input:focus,.field select:focus{outline:none;border-color:#ec4899;box-shadow:0 0 0 3px rgba(236,72,153,.1)}
    .field input.mono{font-family:monospace;font-size:.8rem}
    .field .desc{font-size:.75rem;color:#6b7280;margin-top:.375rem;line-height:1.5}

    .grid-2{display:grid;grid-template-columns:1fr 1fr;gap:1rem}

    /* Buttons */
    .btn-row{display:flex;gap:.75rem;margin-top:1.75rem;padding-top:1.25rem;border-top:1px solid #fce7f3}
    .btn{padding:.7rem 1.5rem;border-radius:.625rem;font-size:.875rem;font-weight:700;cursor:pointer;border:none;font-family:inherit;transition:all .15s;display:inline-flex;align-items:center;gap:.4rem}
    .btn-primary{background:#ec4899;color:#fefce8}
    .btn-primary:hover{background:#db2777}
    .btn-outline{background:#fefce8;color:#6b7280;border:1.5px solid #fbcfe8}
    .btn-outline:hover{background:#fdf4f7}
    .btn-skip{background:#f0fdf4;color:#15803d;border:1.5px solid #bbf7d0;margin-left:auto}
    .btn-skip:hover{background:#dcfce7}
    .btn-test{background:#fce7f3;color:#ec4899;border:1.5px solid #fbcfe8;padding:.55rem 1rem;font-size:.8rem}
    .btn-test:hover{background:#fbcfe8}

    /* Test result */
    .test-result{margin-top:.75rem;padding:.75rem 1rem;border-radius:.625rem;font-size:.8rem;display:none}
    .test-result.ok{background:#f0fdf4;border:1px solid #bbf7d0;color:#15803d}
    .test-result.fail{background:#fef2f2;border:1px solid #fecaca;color:#b91c1c}

    /* Alerts */
    .alert{padding:.875rem 1rem;border-radius:.625rem;font-size:.85rem;margin-bottom:1rem;display:flex;gap:.625rem;align-items:flex-start}
    .alert-err{background:#fef2f2;border:1px solid #fecaca;color:#b91c1c}
    .alert-info{background:#f0fdf4;border:1px solid #bbf7d0;color:#15803d}
    .alert-warn{background:#fffbeb;border:1px solid #fde68a;color:#92400e}

    /* Done */
    .done-wrap{text-align:center;padding:2rem 0}
    .done-wrap .big-icon{font-size:4rem;margin-bottom:1rem}
    .done-wrap h2{font-size:1.4rem;font-weight:900;color:#831843;margin-bottom:.5rem}
    .done-wrap p{color:#6b7280;font-size:.9rem;line-height:1.6}
    .cred-table{width:100%;border-collapse:collapse;margin-top:1.25rem;text-align:left;border:1px solid #fbcfe8;border-radius:.75rem;overflow:hidden}
    .cred-table th{background:#fce7f3;padding:.6rem 1rem;font-size:.75rem;font-weight:700;color:#ec4899;text-transform:uppercase;letter-spacing:.05em}
    .cred-table td{padding:.65rem 1rem;font-size:.825rem;border-top:1px solid #fce7f3}
    .cred-table td:first-child{font-weight:600;color:#831843;width:42%}
    .cred-table td:last-child{font-family:monospace;color:#111827}
    .delete-warning{background:#fef2f2;border:1.5px solid #fca5a5;border-radius:.75rem;padding:1rem 1.25rem;margin-top:1.25rem;font-size:.85rem;color:#b91c1c;line-height:1.6}

    /* Info box */
    .info-box{background:#fce7f3;border:1px solid #fbcfe8;border-radius:.75rem;padding:1rem 1.25rem;font-size:.8rem;color:#9d174d;line-height:1.7;margin-bottom:1.25rem}
    .info-box a{color:#ec4899;font-weight:700}

    /* Section sep */
    .sep{border:none;border-top:1px solid #fce7f3;margin:1.5rem 0}

    @media(max-width:680px){
      .page{flex-direction:column}
      .sidebar{width:100%;position:static}
      .steps-nav{flex-direction:row;overflow-x:auto;gap:.5rem;padding:.75rem}
      .step-item .label-text{display:none}
      .grid-2{grid-template-columns:1fr}
    }
  </style>
</head>
<body>
<div class="page">

  <!-- Sidebar -->
  <aside class="sidebar">
    <div class="brand">
      <div class="mark">⚙</div>
      <div class="company">ProcureFlow</div>
      <div class="sub">System Setup Wizard</div>
    </div>
    <nav class="steps-nav">
      <?php
      $stepDefs = [
        ['key' => 'requirements', 'num' => 1, 'icon' => '🔍', 'label' => 'Requirements'],
        ['key' => 'step2',        'num' => 2, 'icon' => '🗄️', 'label' => 'Database & App'],
        ['key' => 'step3b',       'num' => 3, 'icon' => '👤', 'label' => 'Admin Account'],
        ['key' => 'step4b',       'num' => 4, 'icon' => '🏢', 'label' => 'Organization'],
        ['key' => 'install',      'num' => 5, 'icon' => '🚀', 'label' => 'Install'],
      ];
      foreach ($stepDefs as $s):
        $cls = 'step-item';
        if ($s['num'] < $currentNum) $cls .= ' done';
        elseif ($s['num'] === $currentNum) $cls .= ' active';
      ?>
      <div class="<?= $cls ?>">
        <div class="num"><?= $s['num'] < $currentNum ? '✓' : $s['num'] ?></div>
        <span class="label-text"><?= $s['label'] ?></span>
      </div>
      <?php endforeach; ?>
    </nav>
  </aside>

  <!-- Main content -->
  <div class="main">

    <?php foreach ($errors as $e): ?>
      <div class="alert alert-err">❌ <?= $e ?></div>
    <?php endforeach; ?>

    <!-- ── STEP 1: Requirements ─────────────────────────────────────────── -->
    <?php if (in_array($step, ['requirements', 'step2'])): ?>
    <div class="card">
      <div class="card-header">
        <div class="icon">🔍</div>
        <div>
          <h2>System Requirements</h2>
          <p>Verifying your server environment before installation</p>
        </div>
      </div>
      <div class="card-body">
        <?php foreach ($checks as [$label, $pass, $detail]): ?>
        <div class="check-row <?= $pass ? 'pass' : 'fail' ?>">
          <span><?= $pass ? '✅' : '❌' ?></span>
          <span style="flex:1"><?= htmlspecialchars($label) ?></span>
          <span class="check-detail"><?= htmlspecialchars((string)$detail) ?></span>
        </div>
        <?php endforeach; ?>

        <?php if (!$allPass): ?>
        <div class="alert alert-warn" style="margin-top:1rem">
          ⚠️ Fix the failing requirements above, then refresh this page. If you installed a PHP extension, restart your web server.
        </div>
        <?php else: ?>
        <form method="POST">
          <input type="hidden" name="step" value="step2" />
          <div class="btn-row">
            <button type="submit" class="btn btn-primary">Continue → Database Setup</button>
          </div>
        </form>
        <?php endif; ?>
      </div>
    </div>

    <!-- ── STEP 2: Database & App URL ───────────────────────────────────── -->
    <?php elseif ($step === 'step2'): ?>
    <?php // Fall through to next rendered step — handled by redirect ?>
    <?php endif; ?>

    <?php if ($step === 'step2'): ?>
    <div class="card" style="margin-top:1.25rem">
      <div class="card-header">
        <div class="icon">🗄️</div>
        <div>
          <h2>Database &amp; Application Settings</h2>
          <p>Configure MongoDB connection and core application settings</p>
        </div>
      </div>
      <div class="card-body">
        <form method="POST">
          <input type="hidden" name="step" value="step3b" />

          <div class="info-box">
            💡 MongoDB Atlas (cloud) URI format:<br />
            <code>mongodb+srv://user:pass@cluster.mongodb.net/?retryWrites=true&w=majority</code><br />
            Local: <code>mongodb://localhost:27017</code>
          </div>

          <div class="field">
            <label>MongoDB Connection URI <span style="color:red">*</span></label>
            <input name="mongo_uri" class="mono" value="<?= htmlspecialchars($d['mongo_uri']) ?>" placeholder="mongodb://localhost:27017" required />
            <div class="desc">Full connection string including credentials if authentication is enabled.</div>
          </div>
          <div class="grid-2">
            <div class="field">
              <label>Database Name <span style="color:red">*</span></label>
              <input name="mongo_db" value="<?= htmlspecialchars($d['mongo_db']) ?>" placeholder="purchase_approval" required />
            </div>
            <div class="field">
              <label>JWT Secret Key <span style="color:red">*</span></label>
              <input name="jwt_secret" class="mono" value="<?= htmlspecialchars($d['jwt_secret']) ?>" required />
              <div class="desc">Auto-generated. Keep this private and never share it.</div>
            </div>
          </div>
          <div class="field">
            <label>Application URL <span style="color:red">*</span> <span class="hint">(no trailing slash)</span></label>
            <input name="app_url" value="<?= htmlspecialchars($d['app_url']) ?>" placeholder="https://yourdomain.com" required />
            <div class="desc">The public URL where this system is hosted. Used for OAuth redirect URIs and email links.</div>
          </div>

          <button type="button" class="btn btn-test" onclick="testMongo(this)">🔌 Test MongoDB Connection</button>
          <div id="mongo-result" class="test-result"></div>

          <div class="btn-row">
            <a href="install.php?step=requirements" class="btn btn-outline">← Back</a>
            <button type="submit" class="btn btn-primary">Continue → Create Admin Account</button>
          </div>
        </form>
      </div>
    </div>

    <!-- ── STEP 3: Create Super Admin ──────────────────────────────────── -->
    <?php elseif (in_array($step, ['step3b', 'step4'])): ?>
    <div class="card">
      <div class="card-header">
        <div class="icon">👤</div>
        <div>
          <h2>Create Super Admin Account</h2>
          <p>This will be the first administrator account — used to log in after installation</p>
        </div>
      </div>
      <div class="card-body">
        <div class="info-box">
          🔐 The super admin account gives full access to the system. Additional admin accounts can be created from the Admin Panel after login. This account cannot be deleted once created.
        </div>

        <form method="POST">
          <input type="hidden" name="step" value="step4" />

          <div class="field">
            <label>Full Name <span style="color:red">*</span></label>
            <input name="admin_name" value="<?= htmlspecialchars($d['admin_name'] ?? '') ?>" placeholder="e.g. Ahmed Al Rashidi" required />
          </div>
          <div class="field">
            <label>Email Address <span style="color:red">*</span></label>
            <input type="email" name="admin_email" value="<?= htmlspecialchars($d['admin_email'] ?? '') ?>" placeholder="admin@yourcompany.com" required autocomplete="email" />
            <div class="desc">Use your company email. This will be your login username.</div>
          </div>
          <div class="grid-2">
            <div class="field">
              <label>Password <span style="color:red">*</span> <span class="hint">(min 8 characters)</span></label>
              <input type="password" name="admin_password" placeholder="••••••••" required minlength="8" autocomplete="new-password" />
            </div>
            <div class="field">
              <label>Confirm Password <span style="color:red">*</span></label>
              <input type="password" name="admin_confirm" placeholder="••••••••" required autocomplete="new-password" />
            </div>
          </div>

          <div class="btn-row">
            <a href="install.php?step=step2" class="btn btn-outline">← Back</a>
            <button type="submit" class="btn btn-primary">Continue → Organization →</button>
          </div>
        </form>
      </div>
    </div>

    <!-- ── STEP 4: Organization (Optional) ──────────────────────────────── -->
    <?php elseif (in_array($step, ['step4b'])): ?>
    <div class="card">
      <div class="card-header">
        <div class="icon">🏢</div>
        <div>
          <h2>Your Organization <span style="font-size:.75rem;font-weight:500;color:#6b7280">(Optional)</span></h2>
          <p>Add your company details — you can always update these from Settings → Companies after login</p>
        </div>
      </div>
      <div class="card-body">
        <div class="info-box">
          💡 This step is <strong>optional</strong>. If you skip it, the system will work without a company profile. You can add or update company details at any time from <strong>Settings → Companies</strong> once logged in.
        </div>

        <form method="POST">
          <input type="hidden" name="step" value="install" />

          <div class="field">
            <label>Organization / Company Name</label>
            <input name="org_name" value="<?= htmlspecialchars($d['org_name'] ?? '') ?>" placeholder="e.g. Acme Corporation" />
            <div class="desc">The name shown in the portal header and emails.</div>
          </div>
          <div class="field">
            <label>Logo URL <span class="hint">(optional)</span></label>
            <input name="org_logo_url" value="<?= htmlspecialchars($d['org_logo_url'] ?? '') ?>" placeholder="https://yourcompany.com/logo.png" />
            <div class="desc">A public URL to your logo image. You can upload a logo file from Settings → Companies after install.</div>
          </div>
          <div class="grid-2">
            <div class="field">
              <label>Contact Email</label>
              <input type="email" name="org_email" value="<?= htmlspecialchars($d['org_email'] ?? '') ?>" placeholder="info@yourcompany.com" />
            </div>
            <div class="field">
              <label>Phone</label>
              <input name="org_phone" value="<?= htmlspecialchars($d['org_phone'] ?? '') ?>" placeholder="+1 555 000 0000" />
            </div>
          </div>

          <div class="btn-row">
            <a href="install.php?step=step3b" class="btn btn-outline">← Back</a>
            <button type="submit" name="step" value="install" class="btn btn-skip">Skip</button>
            <button type="submit" name="step" value="install" class="btn btn-primary">Continue → Install →</button>
          </div>
        </form>
      </div>
    </div>

    <!-- ── STEP 5: Install ───────────────────────────────────────────────── -->
    <?php elseif ($step === 'install'): ?>
    <div class="card">
      <div class="card-header">
        <div class="icon">🚀</div>
        <div>
          <h2>Ready to Install</h2>
          <p>Review your settings and start the installation</p>
        </div>
      </div>
      <div class="card-body">
        <table class="cred-table">
          <tr><th colspan="2">Configuration Summary</th></tr>
          <tr><td>MongoDB URI</td><td><?= htmlspecialchars(preg_replace('/:\/\/[^@]+@/', '://***:***@', $d['mongo_uri'] ?? '')) ?></td></tr>
          <tr><td>Database</td><td><?= htmlspecialchars($d['mongo_db'] ?? '') ?></td></tr>
          <tr><td>App URL</td><td><?= htmlspecialchars($d['app_url'] ?? '') ?></td></tr>
          <tr><td>Admin Account</td><td><?= !empty($d['admin_email']) ? '✅ ' . htmlspecialchars($d['admin_email']) : '❌ Not configured' ?></td></tr>
        </table>

        <?php if (empty($d['admin_email'])): ?>
          <div class="alert alert-err" style="margin-top:1rem">❌ Admin account not configured — <a href="install.php?step=step3b" style="color:inherit;font-weight:700">go back to Step 3</a> to set it up.</div>
        <?php else: ?>
        <form method="POST" style="margin-top:1.5rem">
          <input type="hidden" name="step" value="install" />
          <?php foreach ($errors as $e): ?>
            <div class="alert alert-err"><?= $e ?></div>
          <?php endforeach; ?>
          <div class="btn-row" style="border:none;padding:0;margin:0">
            <a href="install.php?step=step4b" class="btn btn-outline">← Back</a>
            <button type="submit" class="btn btn-primary" style="font-size:1rem;padding:.875rem 2rem">🚀 Install Now</button>
          </div>
        </form>
        <?php endif; ?>
      </div>
    </div>

    <!-- ── DONE ─────────────────────────────────────────────────────────── -->
    <?php elseif ($step === 'done'): ?>
    <div class="card">
      <div class="card-body">
        <div class="done-wrap">
          <div class="big-icon">🎉</div>
          <h2>Installation Complete!</h2>
          <p>Your Purchase Approval System is ready.<br />Sign in with the admin account below to get started.</p>

          <?php foreach ($info as $i): ?>
            <div class="alert alert-info" style="text-align:left;margin-top:.5rem">✅ <?= $i ?></div>
          <?php endforeach; ?>

          <table class="cred-table" style="margin-top:1.5rem;text-align:left">
            <tr><th colspan="2">Your Admin Login</th></tr>
            <tr><td>Staff Login</td><td><a href="portal.html" style="color:#ec4899;font-weight:700">portal.html</a></td></tr>
            <tr><td>Admin Email</td><td><?= htmlspecialchars($createdAdminEmail ?? '(see install log above)') ?></td></tr>
            <tr><td>Password</td><td>The password you set during setup</td></tr>
            <tr><td>Home Page</td><td><a href="index.html" style="color:#7c3aed">index.html</a></td></tr>
          </table>

          <div class="delete-warning" style="margin-top:1.5rem">
            🗑️ <strong>Important — Security:</strong><br />
            Delete <code>install.php</code> from your server immediately after setup. Leaving it accessible allows anyone to overwrite your configuration.
          </div>

          <a href="portal.html" style="display:inline-flex;align-items:center;gap:.5rem;margin-top:1.5rem;padding:.875rem 2rem;background:#ec4899;color:#fefce8;border-radius:10px;font-weight:700;text-decoration:none;font-size:.95rem">
            🔐 Go to Staff Login →
          </a>
        </div>
      </div>
    </div>
    <?php endif; ?>

  </div><!-- /main -->
</div><!-- /page -->

<script>
async function testMongo(btn) {
  // Save current form values to session first
  const form = btn.closest('form');
  const fd = new FormData(form);
  fd.delete('step');
  await fetch('install.php', { method:'POST', body: new URLSearchParams({ step:'step2', ...Object.fromEntries(fd) }) });

  btn.disabled = true; btn.textContent = 'Testing…';
  const res = await fetch('install.php?step=test_mongo');
  const data = await res.json();
  const el = document.getElementById('mongo-result');
  el.className = 'test-result ' + (data.ok ? 'ok' : 'fail');
  el.textContent = (data.ok ? '✅ ' : '❌ ') + data.msg;
  el.style.display = 'block';
  btn.disabled = false; btn.textContent = '🔌 Test MongoDB Connection';
}

</script>
</body>
</html>
