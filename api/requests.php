<?php
require_once __DIR__ . '/../includes/auth.php';

$method = $_SERVER['REQUEST_METHOD'];
$id     = $_GET['id']     ?? null;
$action = $_GET['action'] ?? null;

function mongo_doc($doc): array {
    if (!$doc) return [];
    $arr = (array)$doc;
    $arr['id'] = (string)($arr['_id'] ?? '');
    return $arr;
}

function get_approver_role($amount) {
    $levels = iterator_to_array(db()->approval_levels->find([], ['sort' => ['max_amount' => 1]]));
    foreach ($levels as $lvl) {
        if ($amount <= $lvl['max_amount']) return $lvl['role'];
    }
    return !empty($levels) ? end($levels)['role'] : 'ceo';
}

// GET /api/requests
if ($method === 'GET' && !$id) {
    $user = require_auth();
    $filter = [];
    if ($user['role'] !== 'admin') {
        $filter['$or'] = [
            ['requester_id' => $user['sub']],
            ['current_approver_role' => $user['role']],
            ['history.approver_id' => $user['sub']]
        ];
    }
    if (!empty($_GET['pending'])) {
        $filter['status'] = 'pending';
        if ($user['role'] !== 'admin') {
            $filter['current_approver_role'] = $user['role'];
            unset($filter['$or']);
        }
    }
    $rows = iterator_to_array(db()->requests->find($filter, ['sort' => ['created_at' => -1]]));
    json_ok(array_map('mongo_doc', $rows));
}

// POST /api/requests
if ($method === 'POST' && !$id) {
    $user = require_auth();
    $b = body();
    if (empty($b['title']) || empty($b['amount'])) json_err('title and amount are required');
    
    $amount = (float)$b['amount'];
    $doc = [
        '_id'            => new_id(),
        'title'          => trim($b['title']),
        'description'    => $b['description'] ?? '',
        'amount'         => $amount,
        'category'       => $b['category'] ?? 'General',
        'requester_id'   => $user['sub'],
        'requester_name' => $user['name'],
        'department'     => $user['department'] ?? '',
        'status'         => 'pending',
        'current_approver_role' => get_approver_role($amount),
        'history'        => [],
        'created_at'     => now_iso(),
        'updated_at'     => now_iso(),
    ];

    db()->requests->insertOne($doc);
    json_ok(mongo_doc($doc), 201);
}

// GET /api/requests/:id
if ($method === 'GET' && $id) {
    require_auth();
    $doc = db()->requests->findOne(['_id' => $id]);
    if (!$doc) json_err('Not found', 404);
    json_ok(mongo_doc($doc));
}

// POST /api/requests/:id/:action (approve/reject/cancel)
if ($method === 'POST' && $id && $action) {
    $user = require_auth();
    $doc = db()->requests->findOne(['_id' => $id]);
    if (!$doc) json_err('Not found', 404);

    if ($action === 'approve' || $action === 'reject') {
        if ($doc['status'] !== 'pending') json_err('Request is not pending');
        if ($user['role'] !== 'admin' && $doc['current_approver_role'] !== $user['role']) {
            json_err('Not authorized to act on this request', 403);
        }

        $b = body();
        $status = ($action === 'approve') ? 'approved' : 'rejected';
        $history_item = [
            'id'            => new_id(),
            'approver_id'   => $user['sub'],
            'approver_name' => $user['name'],
            'approver_role' => $user['role'],
            'action'        => $status,
            'comments'      => $b['comments'] ?? $b['comment'] ?? '',
            'created_at'    => now_iso(),
        ];
        db()->requests->updateOne(['_id' => $id], ['$set' => ['status' => $status, 'current_approver_role' => null, 'updated_at' => now_iso()], '$push' => ['history' => $history_item]]);
        json_ok(['success' => true]);
    }

    if ($action === 'cancel') {
        if ($doc['requester_id'] !== $user['sub'] && $user['role'] !== 'admin') json_err('Forbidden', 403);
        db()->requests->updateOne(['_id' => $id], ['$set' => ['status' => 'cancelled', 'updated_at' => now_iso()]]);
        json_ok(['success' => true]);
    }
}

json_err('Not found', 404);