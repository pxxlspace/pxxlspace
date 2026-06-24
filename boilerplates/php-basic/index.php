<?php
header('Content-Type: application/json');
echo json_encode([
    'ok' => true,
    'service' => 'PHP on Pxxl',
    'time' => gmdate('c'),
]);
