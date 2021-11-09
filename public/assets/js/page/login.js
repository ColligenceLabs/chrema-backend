const View = {
	form: {
		getData(){
			var email = $("input[name=email]").val();
			var password = $("input[name=password]").val();
			return {
				email 	: email,
				password: password,
			};
		},
		onPush(name, callback){
            $(document).on('click', '.btn-login', function() {
                if($(this).attr('atr').trim() == name) {
                    callback();
                }
            });
		},
		onSuccess(data){
            localStorage.setItem('accessToken', data.data.accessToken || null);
            localStorage.setItem('refreshToken', data.data.refreshToken || null);
            localStorage.setItem('infor', JSON.stringify(data.data.infor) || null);
            
            window.location.href = '/';
		},
		onError(message){
			$('.notification').find('.alert').remove();
			$('.notification')
				.append(`<div class="alert alert-danger">
						    ${message}
						</div>`)
		}
	},
	init(){}
};
(() => {
    View.init();

    if (localStorage.getItem('accessToken')) {
    	window.location.href = '/';
    }


    View.form.onPush('Login', () => {
    	Api.Auth.Login(View.form.getData())
            .done(res => {
                console.log(res);
                if (res.status == 0) {
                	View.form.onError(res.message)
                }else{
                	View.form.onSuccess(res)
                }
            })
            .fail(err => {
                console.log(err);
            })
            .always(() => {
            });
        })
})();