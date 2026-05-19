<?php
require_once __DIR__ . '/../includes/auth.php';

$method = $_SERVER['REQUEST_METHOD'];
$path   = trim($_GET['path'] ?? '', '/');

function mongo_doc($doc): array {
    if (!$doc) return [];
    $arr = (array)$doc;
    $arr['id'] = (string)($arr['_id'] ?? '');
    return $arr;
}

// GET /api/admin/app-info — public branding endpoint (no auth required)
if ($method === 'GET' && $path === 'app-info') {
    $company = db()->companies->findOne(['is_active' => true], ['sort' => ['created_at' => 1]]);
    json_ok([
        'name' => $company ? (string)($company['name'] ?? 'ProcureFlow') : 'ProcureFlow',
        'logo' => ($company && !empty($company['logo_filename'])) ? '/uploads/' . $company['logo_filename'] : null,
    ]);
}

// GET /api/admin/approval-levels
if ($method === 'GET' && $path === 'approval-levels') {
    require_admin();
    $levels = iterator_to_array(db()->approval_levels->find());
    $order  = ['employee' => 1, 'manager' => 2, 'department_head' => 3, 'ceo' => 4];
    usort($levels, fn($a, $b) => ($order[$a['role']] ?? 9) <=> ($order[$b['role']] ?? 9));
    $labels = [
        'employee'        => 'Employee',
        'manager'         => 'Manager',
        'department_head' => 'Department Head',
        'ceo'             => 'CEO',
    ];
    foreach ($levels as &$l) { $l['label'] = $labels[$l['role']] ?? $l['role']; }
    json_ok(array_map('mongo_doc', $levels));
}

// PUT /api/admin/approval-levels
if ($method === 'PUT' && $path === 'approval-levels') {
    require_admin();
    $b = body();
    foreach ($b['levels'] ?? [] as $level) {
        db()->approval_levels->updateOne(
            ['role' => $level['role']],
            ['$set' => ['max_amount' => floatval($level['max_amount'])]],
            ['upsert' => true]
        );
    }
    json_ok(['success' => true]);
}

// GET /api/admin/stats
if ($method === 'GET' && $path === 'stats') {
    require_auth();
    json_ok([
        'total_requests'   => db()->requests->countDocuments([]),
        'pending_requests' => db()->requests->countDocuments(['status' => 'pending']),
        'approved_requests'=> db()->requests->countDocuments(['status' => 'approved']),
        'total_vendors'    => db()->vendors->countDocuments([]),
        'pending_vendors'  => db()->vendors->countDocuments(['status' => 'pending']),
        'open_tenders'     => db()->tenders->countDocuments(['status' => 'open']),
        'total_lpos'       => db()->lpos->countDocuments([]),
    ]);
}

json_err('Not found', 404);
