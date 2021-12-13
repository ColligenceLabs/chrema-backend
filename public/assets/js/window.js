const ViewIndex = {
    
};
(() => {
    
    $('.logout-form').on('click', function(){
        localStorage.removeItem("accessToken"); 
        localStorage.removeItem("refreshToken"); 
        localStorage.removeItem("infor"); 
        window.location.href = '/admp/login';
    })
    try {
        // cài đặt open menu khi chuyển trang
        var menu = $('.menu-data').val().split(" | ")
        $(`.${menu[0]}`).addClass('open')
        $(`.${menu[1]}`).addClass('active')
    } catch (error) {
        console.error(error);
    }

    $('.admin-name').html(JSON.parse(localStorage.getItem("infor")).full_name)
    $(document).on('change', '#image', function(e) {
        if(this.files[0].size > 5242880){
           alert("Max file 5 MB!");
        }else{
            var img = new Image;
            img.src = URL.createObjectURL(e.target.files[0]);
            img.onload = function() {
                $('.story-banner').find('img').attr('src', URL.createObjectURL(e.target.files[0]))
            }
        }
    });

    
    
})();