const View = {
    info: null,
    user_id: null,
    onProfile(name, callback) {
        $(document).on('click', '.change-profile', function() {
            if($(this).attr('atr').trim() == name) {
                callback();
            }
        });
    },
    onPassword(name, callback) {
        $(document).on('click', '.change-password', function() {
            if($(this).attr('atr').trim() == name) {
                callback();
            }
        });
    },
    setProfile(data){
        localStorage.setItem('infor', JSON.stringify(data) || null);
    },
    init(data){
        $('.username').val(data.full_name)
        View.user_id = data.id
    }
};


(() => {
    View.init(JSON.parse(localStorage.getItem("infor")));
    View.info = JSON.parse(localStorage.getItem("infor"))
    console.log(JSON.parse(localStorage.getItem("infor")));

    Api.Auth.Detail(View.user_id)
        .done(res => {
            $('.address').val(res.data.admin_address)
        })
        .fail(err => {
        })
        .always(() => {
        });

    View.onProfile("Save", () => {
        $('#user-info').find('.alert-success').remove();
        Api.Auth.Update(View.user_id, $('.username').val(), $('.address').val())
            .done(res => {
                View.info.full_name = $('.username').val()
                View.setProfile(View.info)
                $('#user-info').prepend(`
                    <div class="alert alert-success alert-dismissible fade show">
                        <span class="alert-icon">
                            <i class="anticon anticon-check-o"></i>
                        </span>
                        <span>Update successful</span>
                        <button type="button" class="close" data-dismiss="alert" aria-label="Close">
                            <span aria-hidden="true">&times;</span>
                        </button>
                    </div>
                `)
            })
            .fail(err => {
                $('#user-info').prepend(`
                    <div class="alert alert-success alert-dismissible fade show">
                        <span class="alert-icon">
                            <i class="anticon anticon-check-o"></i>
                        </span>
                        <span>Update false</span>
                        <button type="button" class="close" data-dismiss="alert" aria-label="Close">
                            <span aria-hidden="true">&times;</span>
                        </button>
                    </div>
                `)
            })
            .always(() => {
            });
    })
    View.onPassword("Save", () => {
        data = {
            'password': $('.password').val(),
            'old_password': $('.old-password').val(),
        }
        Api.Auth.UpdatePassword(View.user_id, data)
            .done(res => {
                if (res.status == 1) {
                    $('#user-info').prepend(`
                        <div class="alert alert-success alert-dismissible fade show">
                            <span class="alert-icon">
                                <i class="anticon anticon-check-o"></i>
                            </span>
                            <span>Update password successful</span>
                            <button type="button" class="close" data-dismiss="alert" aria-label="Close">
                                <span aria-hidden="true">&times;</span>
                            </button>
                        </div>
                    `)
                }else{
                    $('#user-info').prepend(`
                        <div class="alert alert-danger alert-dismissible fade show">
                            <span class="alert-icon">
                                <i class="anticon anticon-check-o"></i>
                            </span>
                            <span>Update password false</span>
                            <button type="button" class="close" data-dismiss="alert" aria-label="Close">
                                <span aria-hidden="true">&times;</span>
                            </button>
                        </div>
                    `)
                }
            })
            .fail(err => {
                $('#user-info').prepend(`
                    <div class="alert alert-danger alert-dismissible fade show">
                        <span class="alert-icon">
                            <i class="anticon anticon-check-o"></i>
                        </span>
                        <span>Update password false</span>
                        <button type="button" class="close" data-dismiss="alert" aria-label="Close">
                            <span aria-hidden="true">&times;</span>
                        </button>
                    </div>
                `)
            })
            .always(() => {
            });
    })


    
})();

