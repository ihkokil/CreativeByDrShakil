<?php
// ==============================================================================
// Hostinger Secure Upload Script
// Place this file in the root of files.creativebydrshakil.com
// ==============================================================================

// Enforce CORS for your Next.js application
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, X-Upload-Token");
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Security: Define your secret token here!
// THIS MUST MATCH THE TOKEN IN YOUR NEXT.JS .env FILE
$SECRET_TOKEN = 'YOUR_SUPER_SECRET_TOKEN_HERE';

// Authenticate
$headers = getallheaders();
$providedToken = isset($headers['X-Upload-Token']) ? $headers['X-Upload-Token'] : '';

if ($providedToken !== $SECRET_TOKEN) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized. Invalid upload token.']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed.']);
    exit;
}

// Validate File Upload
if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode(['error' => 'No file uploaded or upload error.']);
    exit;
}

$fileName = isset($_POST['fileName']) ? basename($_POST['fileName']) : basename($_FILES['file']['name']);
$fileExt = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));

// Define allowed extensions based on user request
$allowedExtensions = [
    // Images
    'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'tiff', 'ico',
    // Videos
    'mp4', 'webm', 'ogg', 'avi', 'mov', 'mkv', 'flv', 'wmv', 'm4v',
    // Documents
    'pdf', 'doc', 'docx', 'ppt', 'pptx', 'txt', 'csv'
];

if (!in_array($fileExt, $allowedExtensions)) {
    http_response_code(415);
    echo json_encode(['error' => "Unsupported file type: .$fileExt. Only images, videos, and standard documents are allowed."]);
    exit;
}

// Get POST variables
$folderPath = isset($_POST['folderPath']) ? trim($_POST['folderPath'], '/') : 'uploads';

// Construct target directory
$targetDir = __DIR__ . '/' . $folderPath;

// Create directory if it doesn't exist
if (!is_dir($targetDir)) {
    if (!mkdir($targetDir, 0755, true)) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to create directories on the server.']);
        exit;
    }
}

// Construct final file path
$targetFile = $targetDir . '/' . $fileName;

// Move the uploaded file
if (move_uploaded_file($_FILES['file']['tmp_name'], $targetFile)) {
    // Return relative path or success flag
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'path' => $folderPath . '/' . $fileName
    ]);
} else {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to move uploaded file.']);
}
?>
