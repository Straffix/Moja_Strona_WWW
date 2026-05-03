<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=UTF-8');
ini_set('display_errors', '0');

$configPath = __DIR__ . '/contact-config.php';

if (!is_file($configPath)) {
	respond(500, [
		'ok' => false,
		'message' => 'Brak konfiguracji formularza kontaktowego.',
	]);
}

/** @var array<string, mixed> $config */
$config = require $configPath;

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
	respond(405, [
		'ok' => false,
		'message' => 'Dozwolona jest tylko metoda POST.',
	]);
}

try {
	validateConfig($config);

	if (trim((string) ($_POST['company_website'] ?? '')) !== '') {
		respond(200, [
			'ok' => true,
			'message' => 'Wiadomość została przyjęta.',
		]);
	}

	$name = sanitizeSingleLine((string) ($_POST['name'] ?? ''));
	$email = sanitizeSingleLine((string) ($_POST['email'] ?? ''));
	$subject = sanitizeSingleLine((string) ($_POST['subject'] ?? ''));
	$message = sanitizeMessage((string) ($_POST['message'] ?? ''));

	validateContactPayload($name, $email, $subject, $message);

	$attachments = prepareAttachments(
		normalizeUploadedFiles($_FILES['attachments'] ?? null),
		$config['limits'] ?? [],
	);

	$body = buildPlainTextBody($name, $email, $subject, $message, $attachments);

	sendViaSmtp($config, [
		'subject' => buildMailSubject($config, $subject),
		'body' => $body,
		'reply_to_email' => $email,
		'reply_to_name' => $name,
		'attachments' => $attachments,
	]);

	respond(200, [
		'ok' => true,
		'message' => 'Wiadomość została wysłana. Dziękuję za kontakt!',
	]);
} catch (ValidationException $exception) {
	respond(422, [
		'ok' => false,
		'message' => $exception->getMessage(),
	]);
} catch (Throwable $exception) {
	error_log('[contact-form] ' . $exception->getMessage());

	respond(500, [
		'ok' => false,
		'message' => 'Nie udało się wysłać wiadomości. Spróbuj ponownie za chwilę.',
	]);
}

function respond(int $statusCode, array $payload): never
{
	http_response_code($statusCode);
	echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
	exit;
}

function validateConfig(array $config): void
{
	$recipientEmail = (string) ($config['recipient_email'] ?? '');
	$smtp = is_array($config['smtp'] ?? null) ? $config['smtp'] : [];
	$mail = is_array($config['mail'] ?? null) ? $config['mail'] : [];

	if (!filter_var($recipientEmail, FILTER_VALIDATE_EMAIL)) {
		throw new RuntimeException('Niepoprawny adres odbiorcy w konfiguracji formularza.');
	}

	$username = (string) ($smtp['username'] ?? '');
	$password = (string) ($smtp['password'] ?? '');
	$host = trim((string) ($smtp['host'] ?? ''));
	$port = (int) ($smtp['port'] ?? 0);
	$encryption = strtolower(trim((string) ($smtp['encryption'] ?? 'tls')));
	$fromEmail = (string) ($mail['from_email'] ?? '');

	if ($host === '' || $port <= 0 || !in_array($encryption, ['tls', 'ssl'], true)) {
		throw new RuntimeException('Brakuje poprawnej konfiguracji połączenia SMTP.');
	}

	if (!filter_var($username, FILTER_VALIDATE_EMAIL) || !filter_var($fromEmail, FILTER_VALIDATE_EMAIL)) {
		throw new RuntimeException('Adres SMTP lub adres nadawcy w konfiguracji jest niepoprawny.');
	}

	if ($password === '' || str_contains($password, 'TU_WPISZ_HASLO')) {
		throw new RuntimeException('Uzupełnij hasło SMTP w pliku contact-config.php.');
	}
}

function validateContactPayload(string $name, string $email, string $subject, string $message): void
{
	if ($name === '' || $email === '' || $subject === '' || $message === '') {
		throw new ValidationException('Uzupełnij wszystkie wymagane pola formularza.');
	}

	if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
		throw new ValidationException('Podaj poprawny adres e-mail.');
	}

	if (stringLength($name) > 120) {
		throw new ValidationException('Pole "Imie / Firma" jest za długie.');
	}

	if (stringLength($subject) > 160) {
		throw new ValidationException('Temat wiadomości jest za długi.');
	}

	if (stringLength($message) > 10000) {
		throw new ValidationException('Wiadomość jest za długa.');
	}
}

function normalizeUploadedFiles(array|null $files): array
{
	if ($files === null || !isset($files['name'])) {
		return [];
	}

	if (!is_array($files['name'])) {
		return [[
			'name' => (string) $files['name'],
			'type' => (string) ($files['type'] ?? ''),
			'tmp_name' => (string) ($files['tmp_name'] ?? ''),
			'error' => (int) ($files['error'] ?? UPLOAD_ERR_NO_FILE),
			'size' => (int) ($files['size'] ?? 0),
		]];
	}

	$normalized = [];

	foreach ($files['name'] as $index => $name) {
		$normalized[] = [
			'name' => (string) $name,
			'type' => (string) ($files['type'][$index] ?? ''),
			'tmp_name' => (string) ($files['tmp_name'][$index] ?? ''),
			'error' => (int) ($files['error'][$index] ?? UPLOAD_ERR_NO_FILE),
			'size' => (int) ($files['size'][$index] ?? 0),
		];
	}

	return $normalized;
}

function prepareAttachments(array $files, array $limits): array
{
	$allowedExtensions = is_array($limits['allowed_extensions'] ?? null) ? $limits['allowed_extensions'] : [];
	$maxFiles = (int) ($limits['max_files'] ?? 5);
	$maxFileSize = (int) ($limits['max_file_size'] ?? (8 * 1024 * 1024));
	$maxTotalSize = (int) ($limits['max_total_size'] ?? (15 * 1024 * 1024));

	$prepared = [];
	$totalSize = 0;

	foreach ($files as $file) {
		if (($file['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE || trim((string) ($file['name'] ?? '')) === '') {
			continue;
		}

		if (count($prepared) >= $maxFiles) {
			throw new ValidationException('Mozesz dołączyć maksymalnie ' . $maxFiles . ' plików.');
		}

		$errorCode = (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE);
		if ($errorCode !== UPLOAD_ERR_OK) {
			throw new ValidationException(mapUploadErrorToMessage($errorCode));
		}

		$originalName = trim((string) ($file['name'] ?? ''));
		$tmpName = (string) ($file['tmp_name'] ?? '');
		$fileSize = (int) ($file['size'] ?? 0);
		$extension = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));

		if (!isset($allowedExtensions[$extension])) {
			throw new ValidationException('Jeden z plików ma niedozwolony format.');
		}

		if ($fileSize <= 0 || $fileSize > $maxFileSize) {
			throw new ValidationException('Jeden z plików przekracza dopuszczalny rozmiar.');
		}

		$totalSize += $fileSize;
		if ($totalSize > $maxTotalSize) {
			throw new ValidationException('Łaczny rozmiar załączników jest zbyt duży.');
		}

		if (!is_uploaded_file($tmpName) || !is_readable($tmpName)) {
			throw new ValidationException('Nie udało się odczytać jednego z załączników.');
		}

		$content = file_get_contents($tmpName);
		if ($content === false) {
			throw new ValidationException('Nie udało się przygotować jednego z załączników.');
		}

		$prepared[] = [
			'filename' => sanitizeFilename($originalName),
			'mime' => detectMimeType($tmpName, (string) $allowedExtensions[$extension]),
			'content' => base64_encode($content),
		];
	}

	return $prepared;
}

function sendViaSmtp(array $config, array $payload): void
{
	$smtp = $config['smtp'];
	$mail = $config['mail'];
	$recipientEmail = (string) $config['recipient_email'];
	$host = (string) $smtp['host'];
	$port = (int) $smtp['port'];
	$encryption = strtolower((string) $smtp['encryption']);
	$username = (string) $smtp['username'];
	$password = (string) $smtp['password'];
	$timeout = (int) ($smtp['timeout'] ?? 20);

	$context = stream_context_create([
		'ssl' => [
			'verify_peer' => true,
			'verify_peer_name' => true,
			'allow_self_signed' => false,
			'peer_name' => $host,
			'SNI_enabled' => true,
		],
	]);

	$target = ($encryption === 'ssl' ? 'ssl://' : '') . $host . ':' . $port;
	$socket = @stream_socket_client($target, $errorNumber, $errorMessage, $timeout, STREAM_CLIENT_CONNECT, $context);

	if (!is_resource($socket)) {
		throw new RuntimeException('Nie udało się połączyć z serwerem SMTP: ' . $errorMessage);
	}

	stream_set_timeout($socket, $timeout);

	try {
		expectSmtpResponse($socket, [220]);

		$clientHost = getClientHostname();
		sendSmtpCommand($socket, 'EHLO ' . $clientHost, [250]);

		if ($encryption === 'tls') {
			sendSmtpCommand($socket, 'STARTTLS', [220]);

			$cryptoEnabled = @stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
			if ($cryptoEnabled !== true) {
				throw new RuntimeException('Nie udało się włączyć szyfrowania TLS dla SMTP.');
			}

			sendSmtpCommand($socket, 'EHLO ' . $clientHost, [250]);
		}

		sendSmtpCommand($socket, 'AUTH LOGIN', [334]);
		sendSmtpCommand($socket, base64_encode($username), [334]);
		sendSmtpCommand($socket, base64_encode($password), [235]);
		sendSmtpCommand($socket, 'MAIL FROM:<' . (string) $mail['from_email'] . '>', [250]);
		sendSmtpCommand($socket, 'RCPT TO:<' . $recipientEmail . '>', [250, 251]);
		sendSmtpCommand($socket, 'DATA', [354]);

		$message = buildMimeMessage($config, $payload);
		$written = fwrite($socket, escapeSmtpData($message) . "\r\n.\r\n");
		if ($written === false) {
			throw new RuntimeException('Nie udało się przesłać treści wiadomości do SMTP.');
		}

		expectSmtpResponse($socket, [250]);
		sendSmtpCommand($socket, 'QUIT', [221]);
	} finally {
		fclose($socket);
	}
}

function buildMimeMessage(array $config, array $payload): string
{
	$mail = $config['mail'];
	$recipientEmail = (string) $config['recipient_email'];
	$fromEmail = (string) $mail['from_email'];
	$fromName = (string) ($mail['from_name'] ?? '');
	$replyToEmail = (string) $payload['reply_to_email'];
	$replyToName = (string) ($payload['reply_to_name'] ?? '');
	$subject = (string) $payload['subject'];
	$body = (string) $payload['body'];
	$attachments = is_array($payload['attachments'] ?? null) ? $payload['attachments'] : [];
	$boundary = 'mixed_' . bin2hex(random_bytes(12));
	$messageIdDomain = strstr($fromEmail, '@');
	$headers = [
		'Date: ' . date(DATE_RFC2822),
		'From: ' . formatAddress($fromEmail, $fromName),
		'To: ' . formatAddress($recipientEmail),
		'Reply-To: ' . formatAddress($replyToEmail, $replyToName),
		'Subject: ' . encodeMimeHeader($subject),
		'Message-ID: <' . bin2hex(random_bytes(12)) . $messageIdDomain . '>',
		'MIME-Version: 1.0',
		'X-Mailer: PHP/' . PHP_VERSION,
		'Content-Type: multipart/mixed; boundary="' . $boundary . '"',
	];

	$parts = [
		'--' . $boundary,
		'Content-Type: text/plain; charset=UTF-8',
		'Content-Transfer-Encoding: quoted-printable',
		'',
		quoted_printable_encode($body),
	];

	foreach ($attachments as $attachment) {
		$filename = addcslashes((string) $attachment['filename'], '"\\');
		$parts[] = '--' . $boundary;
		$parts[] = 'Content-Type: ' . (string) $attachment['mime'] . '; name="' . $filename . '"';
		$parts[] = 'Content-Transfer-Encoding: base64';
		$parts[] = 'Content-Disposition: attachment; filename="' . $filename . '"';
		$parts[] = '';
		$parts[] = chunk_split((string) $attachment['content'], 76, "\r\n");
	}

	$parts[] = '--' . $boundary . '--';
	$parts[] = '';

	return implode("\r\n", array_merge($headers, [''], $parts));
}

function buildPlainTextBody(string $name, string $email, string $subject, string $message, array $attachments): string
{
	$lines = [
		'Nowa wiadomość ze strony ArkadiuszLisiecki.pl',
		'',
		'Imie / firma: ' . $name,
		'E-mail: ' . $email,
		'Temat: ' . $subject,
		'Data: ' . date('Y-m-d H:i:s'),
		'',
		'Wiadomość:',
		$message,
	];

	if ($attachments !== []) {
		$lines[] = '';
		$lines[] = 'Załączniki:';

		foreach ($attachments as $attachment) {
			$lines[] = '- ' . (string) $attachment['filename'];
		}
	}

	return implode("\n", $lines);
}

function buildMailSubject(array $config, string $subject): string
{
	$prefix = trim((string) (($config['mail']['subject_prefix'] ?? '')));
	return $prefix === '' ? $subject : $prefix . ' ' . $subject;
}

function getClientHostname(): string
{
	$host = gethostname();
	if (is_string($host) && $host !== '') {
		return $host;
	}

	return 'localhost';
}

function sendSmtpCommand($socket, string $command, array $expectedCodes): string
{
	$result = fwrite($socket, $command . "\r\n");
	if ($result === false) {
		throw new RuntimeException('Nie udało się wysłać komendy SMTP.');
	}

	return expectSmtpResponse($socket, $expectedCodes);
}

function expectSmtpResponse($socket, array $expectedCodes): string
{
	$responseLines = [];

	while (($line = fgets($socket, 515)) !== false) {
		$responseLines[] = rtrim($line, "\r\n");

		if (strlen($line) < 4 || $line[3] !== '-') {
			break;
		}
	}

	if ($responseLines === []) {
		throw new RuntimeException('Brak odpowiedzi z serwera SMTP.');
	}

	$lastLine = $responseLines[count($responseLines) - 1];
	$code = (int) substr($lastLine, 0, 3);

	if (!in_array($code, $expectedCodes, true)) {
		throw new RuntimeException('SMTP zwrócił błąd ' . $code . ': ' . implode(' | ', $responseLines));
	}

	return implode("\n", $responseLines);
}

function escapeSmtpData(string $message): string
{
	$normalized = preg_replace("/\r\n|\r|\n/", "\r\n", $message);
	$escaped = preg_replace('/^\./m', '..', (string) $normalized);
	return (string) $escaped;
}

function sanitizeSingleLine(string $value): string
{
	$trimmed = trim($value);
	return preg_replace('/[\r\n]+/', ' ', $trimmed) ?? '';
}

function sanitizeMessage(string $value): string
{
	$normalized = preg_replace("/\r\n|\r/", "\n", trim($value));
	$normalized = preg_replace("/\n{3,}/", "\n\n", (string) $normalized);
	return (string) $normalized;
}

function sanitizeFilename(string $filename): string
{
	$filename = preg_replace('/[^\pL\pN._-]+/u', '-', trim($filename)) ?? 'załącznik';
	$filename = trim($filename, '.-');
	return $filename !== '' ? $filename : 'załącznik';
}

function detectMimeType(string $path, string $fallbackMime): string
{
	if (!function_exists('finfo_open')) {
		return $fallbackMime;
	}

	$finfo = finfo_open(FILEINFO_MIME_TYPE);
	if ($finfo === false) {
		return $fallbackMime;
	}

	$detected = finfo_file($finfo, $path);
	finfo_close($finfo);

	return is_string($detected) && $detected !== '' ? $detected : $fallbackMime;
}

function formatAddress(string $email, string $name = ''): string
{
	$email = sanitizeSingleLine($email);
	$name = sanitizeSingleLine($name);

	if ($name === '') {
		return '<' . $email . '>';
	}

	return encodeMimeHeader($name) . ' <' . $email . '>';
}

function encodeMimeHeader(string $value): string
{
	$value = sanitizeSingleLine($value);
	if ($value === '') {
		return '';
	}

	if (preg_match('/^[\x20-\x7E]+$/', $value) === 1) {
		return $value;
	}

	return '=?UTF-8?B?' . base64_encode($value) . '?=';
}

function stringLength(string $value): int
{
	if (function_exists('mb_strlen')) {
		return mb_strlen($value, 'UTF-8');
	}

	return strlen($value);
}

function mapUploadErrorToMessage(int $errorCode): string
{
	return match ($errorCode) {
		UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE => 'Jeden z plików przekracza limit rozmiaru na serwerze.',
		UPLOAD_ERR_PARTIAL => 'Jeden z plików został wysłany tylko częściowo.',
		UPLOAD_ERR_NO_TMP_DIR => 'Na serwerze brakuje katalogu tymczasowego dla załączników.',
		UPLOAD_ERR_CANT_WRITE => 'Serwer nie mógł zapisać jednego z plików.',
		UPLOAD_ERR_EXTENSION => 'Wysyłanie jednego z plików zostało zatrzymane przez rozszerzenie PHP.',
		default => 'Nie udało się przetworzyć jednego z załączników.',
	};
}

final class ValidationException extends RuntimeException
{
}
