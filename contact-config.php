<?php
declare(strict_types=1);

$config = require __DIR__ . '/contact-config.example.php';
$localConfigPath = __DIR__ . '/contact-config.local.php';

if (is_file($localConfigPath)) {
	$localConfig = require $localConfigPath;

	if (is_array($localConfig)) {
		$config = array_replace_recursive($config, $localConfig);
	}
}

$envPassword = trim((string) getenv('CONTACT_SMTP_PASSWORD'));
if ($envPassword !== '') {
	$config['smtp']['password'] = $envPassword;
}

return $config;
