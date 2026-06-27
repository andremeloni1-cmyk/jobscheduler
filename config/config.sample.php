<?php
/**
 * Copy this file to config.php and fill in the values.
 * config.php is git-ignored and must NOT be web-accessible (see .htaccess).
 */

return [
    // --- Database (from Hostinger hPanel > Databases) -----------------------
    'db' => [
        'host' => 'localhost',
        'name' => 'CHANGE_ME_db_name',
        'user' => 'CHANGE_ME_db_user',
        'pass' => 'CHANGE_ME_db_password',
    ],

    // --- Google OAuth (from Google Cloud Console) --------------------------
    'google' => [
        'client_id'     => 'CHANGE_ME.apps.googleusercontent.com',
        'client_secret' => 'CHANGE_ME',
        // Must EXACTLY match the redirect URI you set in Google Cloud Console:
        'redirect_uri'  => 'https://yourdomain.com/jobscheduler/oauth.php',
        // The Google Calendar to write install jobs to ('primary' = your main one):
        'calendar_id'   => 'primary',
        // Drive folder name that holds one sub-folder per job:
        'drive_root'    => 'Install Jobs',
    ],

    // --- Business identity (used on emails + reports) ----------------------
    'business' => [
        'name'       => 'Andre Meloni — Installations',
        'from_email' => 'andre@andremeloniphotography.co',
        'from_name'  => 'Andre Meloni',
        'reply_to'   => 'andre@andremeloniphotography.co',
        'timezone'   => 'Australia/Sydney',
    ],

    // --- App ---------------------------------------------------------------
    'app' => [
        // Used to harden sessions/CSRF. Generate a long random string.
        'secret' => 'CHANGE_ME_long_random_string',
    ],
];
