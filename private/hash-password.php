<?php
declare(strict_types=1);
// 웹에서 실행할 수 없는 비밀번호 해시 생성 도구.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
fwrite(STDERR, "뷰어용 비밀번호 입력 (DSM 비밀번호와 다른 비밀번호): ");
$password = rtrim(fgets(STDIN) ?: '', "\r\n");
if (strlen($password) < 12) { fwrite(STDERR, "12자 이상 입력해 주세요.\n"); exit(1); }
echo password_hash($password, PASSWORD_DEFAULT), PHP_EOL;
