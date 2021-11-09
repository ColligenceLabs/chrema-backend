$(document).ready(function () {
    $('#btn-submit').click(function (e) {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        $.ajax({
            type: 'POST',
            url: '/api/admin/login',
            data: {
                email: email,
                password: password,
            },
            success: (data) => {
                if (data && data.status === 1) {
                    document.getElementById('error').innerHTML =
                        `<div class="alert alert-success" role="alert">
                            ` +
                        `${data.message}` +
                        `
                        </div>`;

                    localStorage.setItem('accessToken', data.data.accessToken || null);
                    localStorage.setItem('refreshToken', data.data.refreshToken || null);
                    localStorage.setItem('infor', JSON.stringify(data.data.infor) || null);
                    setTimeout(() => {
                        document.getElementById('error').innerHTML = '';
                        window.location.href = '/user';
                    }, 2000);
                    return;
                }
                document.getElementById('error').innerHTML =
                    `<div class="alert alert-danger" role="alert">
                    ` +
                    `${data.message}` +
                    `
                  </div>`;
                setTimeout(() => {
                    document.getElementById('error').innerHTML = '';
                }, 3000);
                return;
            },
        });
    });
});
