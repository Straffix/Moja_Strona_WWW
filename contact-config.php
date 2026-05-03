<?php
declare(strict_types=1);

return [
	'recipient_email' => 'kontakt@arkadiuszlisiecki.pl',
	'smtp' => [
		'host' => 'mx.hosti24.pl',
		'port' => 587,
		'encryption' => 'tls', // Use 'tls' for port 587 or 'ssl' for port 465.
		'username' => 'kontakt@arkadiuszlisiecki.pl',
		'password' => '006347978Plxz',
		'timeout' => 20,
	],
	'mail' => [
		'from_email' => 'kontakt@arkadiuszlisiecki.pl',
		'from_name' => 'Formularz kontaktowy - Arkadiusz Lisiecki',
		'subject_prefix' => '[Formularz]',
	],
	'limits' => [
		'max_files' => 5,
		'max_file_size' => 8 * 1024 * 1024,
		'max_total_size' => 15 * 1024 * 1024,
		'allowed_extensions' => [
			'jpg' => 'image/jpeg',
			'jpeg' => 'image/jpeg',
			'png' => 'image/png',
			'gif' => 'image/gif',
			'webp' => 'image/webp',
			'svg' => 'image/svg+xml',
			'pdf' => 'application/pdf',
			'zip' => 'application/zip',
			'fig' => 'application/octet-stream',
			'psd' => 'image/vnd.adobe.photoshop',
			'ai' => 'application/postscript',
			'xd' => 'application/octet-stream',
			'sketch' => 'application/octet-stream',
		],
	],
];
