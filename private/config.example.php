<?php
// 이 파일을 웹 공개 폴더 밖 /volume1/comic-reader-private/config.php 에 복사하세요.
return [
    'root' => '/volume1/comics',
    // password-hash.html 에서 만든 해시로 교체하세요. 평문 비밀번호를 넣지 마세요.
    'password_hash' => '',
    // HTTPS 배포 시 반드시 true. 로컬 HTTP 테스트 때만 false.
    'secure_cookie' => true,
];
