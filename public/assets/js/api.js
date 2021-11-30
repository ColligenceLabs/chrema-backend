const Api = {
    Auth: {},
    User: {},
    Product: {},
    Edition: {},
    Transaction: {},
    Company: {},
    Collection: {},
    Category: {},
    Reward: {},
    Statistics: {},
};
(() => {
    $.ajaxSetup({
        headers: { 
            'X-CSRF-TOKEN': $('meta[name="csrf-token"]').attr('content'),
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}` },
        crossDomain: true,
        error : function(jqXHR, textStatus, errorThrown) {
            if (jqXHR.status == 401) {
                localStorage.removeItem("accessToken"); 
                localStorage.removeItem("refreshToken"); 
                localStorage.removeItem("infor"); 
                window.location.href = '/login';

            } 
        }
    });
})();

// Auth
(() => {
    Api.Auth.Login = (data) => $.ajax({
        url: `/admin-api/admin/login`,
        method: 'POST',
        data: {
            email   : data.email,
            password: data.password,
        },
    });
    Api.Auth.Update = (id, data, address) => $.ajax({
        url: `admin-api/admin/update/${id}`,
        method: 'PUT',
        data: {
            full_name       : data,
            admin_address     : address,
        },
    });
    Api.Auth.UpdatePassword = (id, data) => $.ajax({
        url: `admin-api/admin/update/${id}`,
        method: 'PUT',
        data: {
            password   : data.password,
            old_password   : data.old_password,
        },
    });
    Api.Auth.Detail = (id) => $.ajax({
        url: `/admin-api/admin/detail/${id}`,
        method: 'GET',
    });
})();

// User
(() => {
    Api.User.GetAll = (page, pageSize, filter) => $.ajax({
        url: `/admin-api/user/indexs`,
        method: 'GET',
        dataType: 'json',
        data: {
            page: page ?? '1',
            perPage: pageSize ?? '10',
            status: filter.status ?? '',
            address: filter.address ?? '',
        }
    });
    Api.User.Create = (data) => $.ajax({
        url: `/admin-api/user/create`,
        method: 'POST',
        'data': JSON.stringify(data),
        'processData': false,
        'contentType': 'application/json'
    });
    Api.User.GetOne = (id) => $.ajax({
        url: `/admin-api/user/detail/${id}`,
        method: 'GET',
    });
    Api.User.Update = (id, data) => $.ajax({
        url: `/admin-api/user/update/${id}`,
        method: 'PUT',
        'data': JSON.stringify(data),
        'processData': false,
        'contentType': 'application/json'
    });
    Api.User.UpdateStatus = (id, data) => $.ajax({
        url: `/admin-api/user/update/${id}`,
        method: 'PUT',
        'data': JSON.stringify(data),
        'processData': false,
        'contentType': 'application/json'
    });
    Api.User.Delete = (id) => $.ajax({
        url: `/admin-api/user/delete/${id}`,
        method: 'DELETE',
    });
})();

// Product
(() => {
    Api.Product.GetAll = (page, pageSize, type, filter) => $.ajax({
        url: `/admin-api/nft/indexs`,
        method: 'GET',
        dataType: 'json',
        data: {
            page: page ?? '1',
            perPage: pageSize ?? '10',
            type: type ?? '0',
            status: filter.status ?? '',
            keyword: filter.name ?? '',
        }
    });
    Api.Product.GetAllOf = () => $.ajax({
        url: `/admin-api/nft/indexs`,
        method: 'GET',
        dataType: 'json',
        data: {
            type: 0,
        }
    });
    Api.Product.Create = (formData) => $.ajax({
        url: `/admin-api/nft/create`,
        method: 'POST',
        data: formData,
        contentType: false,
        processData: false,
    });
    Api.Product.GetOne = (id) => $.ajax({
        url: `/admin-api/nft/detail/${id}`,
        method: 'GET',
    });
    Api.Product.Update = (id, data) => $.ajax({
        url: `/admin-api/nft/update/${id}`,
        method: 'PUT',
        'data': JSON.stringify(data),
        'processData': false,
        'contentType': 'application/json'
    });
    Api.Product.UpdateTime = (data) => $.ajax({
        url: `/admin-api/nft/update-schedule`,
        method: 'PUT',
        'data': JSON.stringify(data),
        'processData': false,
        'contentType': 'application/json'
    });
    Api.Product.UpdateStatus = (id, data) => $.ajax({
        url: `/admin-api/nft/update-status/${id}`,
        method: 'PUT',
        'data': JSON.stringify(data),
        'processData': false,
        'contentType': 'application/json'
    });
    Api.Product.Delete = (id) => $.ajax({
        url: `/admin-api/nft/delete/${id}`,
        method: 'DELETE',
    });
    Api.Product.DeleteMany = (ids) => $.ajax({
        url: `/admin-api/nft/delete-many`,
        method: 'DELETE',
        'data': JSON.stringify(ids),
        'processData': false,
        'contentType': 'application/json'
    });
    Api.Product.UpdateSelling = (ids, data_status) => $.ajax({
        url: `admin-api/nft/update/${ids}`,
        method: 'PUT',
        'processData': false,
        'contentType': 'application/json'
    });


})();


// Edition
(() => {
    Api.Edition.GetAll = (page, pageSize, filter) => $.ajax({
        url: `/admin-api/serial/indexs`,
        method: 'GET',
        dataType: 'json',
        data: {
            page: page ?? '1',
            perPage: pageSize ?? '10',
            type: filter.type ?? '',
            status: filter.status ?? '',
            nft_id: filter.nft_id ?? '',
            keyword: filter.keyword ?? '',
        }
    });
    Api.Edition.Create = (data) => $.ajax({
        url: `/admin-api/serial/create`,
        method: 'POST',
        'data': JSON.stringify(data),
        'processData': false,
        'contentType': 'application/json'
    });
    Api.Edition.GetOne = (id) => $.ajax({
        url: `/admin-api/serial/detail/${id}`,
        method: 'GET',
    });
    Api.Edition.Update = (id, data) => $.ajax({
        url: `/admin-api/serial/update/${id}`,
        method: 'PUT',
        'data': JSON.stringify(data),
        'processData': false,
        'contentType': 'application/json'
    });
    Api.Edition.UpdateStatus = (id, data) => $.ajax({
        url: `/admin-api/serial/update/${id}`,
        method: 'PUT',
        'data': JSON.stringify(data),
        'processData': false,
        'contentType': 'application/json'
    });
    Api.Edition.Delete = (id) => $.ajax({
        url: `/admin-api/serial/delete/${id}`,
        method: 'DELETE',
    });
    Api.Edition.DeleteMany = (ids) => $.ajax({
        url: `/admin-api/serial/delete-many`,
        method: 'DELETE',
        'data': JSON.stringify(ids),
        'processData': false,
        'contentType': 'application/json'
    });
})();

// Transaction
(() => {
    Api.Transaction.GetAll = (page, pageSize, filter) => $.ajax({
        url: `/admin-api/transaction/indexs`,
        method: 'GET',
        dataType: 'json',
        data: {
            page: page ?? '1',
            perPage: pageSize ?? '10',
            status: filter.status ?? '',
            keyword: filter.keyword ?? '',
        }
    });
    Api.Transaction.GetOne = (id) => $.ajax({
        url: `/admin-api/transaction/detail/${id}`,
        method: 'GET',
    });
})();

// Company
(() => {
    Api.Company.GetAll = (page, pageSize) => $.ajax({
        url: `/admin-api/company/indexs`,
        method: 'GET',
        dataType: 'json',
        data: {
            page: page ?? '1',
            perPage: pageSize ?? '30',
        }
    });
    Api.Company.GetOne = (id) => $.ajax({
        url: `/admin-api/company/detail/${id}`,
        method: 'GET',
    });
    Api.Company.Create = (data) => $.ajax({
        url: `/admin-api/company/create`,
        method: 'POST',
        data: data,
        contentType: false,
        processData: false,
    });
    Api.Company.Delete = (id) => $.ajax({
        url: `/admin-api/company/delete/${id}`,
        method: 'DELETE',
    });


})();



// Collection
(() => {
    Api.Collection.GetAll = (page, pageSize, filter) => $.ajax({
        url: `/admin-api/collection/indexs`,
        method: 'GET',
        dataType: 'json',
        data: {
            page: page ?? '1',
            perPage: pageSize ?? '10',
            status: filter.status ?? '',
            keyword : filter.keyword  ?? '',
            company: filter.company ?? '',
        }
    });
    Api.Collection.GetNFT = (company_id) => $.ajax({
        url: `/admin-api/collection/getnfts`,
        method: 'GET',
        dataType: 'json',
        data: {
            company_id: company_id,
        }
    });
    Api.Collection.GetOne = (id) => $.ajax({
        url: `/admin-api/collection/detail/${id}`,
        method: 'GET',
    });

    Api.Collection.Delete = (id) => $.ajax({
        url: `/admin-api/collection/delete/${id}`,
        method: 'DELETE',
    });
   
    Api.Collection.Create = (data) => $.ajax({
        url: `/admin-api/collection/create`,
        method: 'POST',
        data: data,
        contentType: false,
        processData: false,
    })
    
    Api.Category.Get = () => $.ajax({
        url: `/admin-api/collection/category`,
        method: 'GET',
    });
    Api.Collection.UpdateStatus = (id, data) => $.ajax({
        url: `/admin-api/collection/update-status/${id}`,
        method: 'PUT',
        'data': JSON.stringify(data),
        'processData': false,
        'contentType': 'application/json'
    });
    Api.Collection.Update = (id, data) => $.ajax({
        url: `/admin-api/collection/update/${id}`,
        method: 'PUT',
        data: JSON.stringify(data),
        'processData': false,
        'contentType': 'application/json'
    });

    
    Api.User.Create = (data) => $.ajax({
        url: `/admin-api/user/create`,
        method: 'POST',
        'data': JSON.stringify(data),
        'processData': false,
        'contentType': 'application/json'
    });
    Api.User.GetOne = (id) => $.ajax({
        url: `/admin-api/user/detail/${id}`,
        method: 'GET',
    });
})();

// Reward
(() => {
    Api.Reward.GetAll = (page, pageSize, filter) => $.ajax({
        url: `/admin-api/reward/indexs`,
        method: 'GET',
        dataType: 'json',
        data: {
            page: page ?? '1',
            perPage: pageSize ?? '10',
            status: filter.status ?? '',
        }
    });
    Api.Reward.Create = (data) => $.ajax({
        url: `/admin-api/reward/create`,
        method: 'POST',
        'data': JSON.stringify(data),
        'processData': false,
        'contentType': 'application/json'
    });
    Api.Reward.GetOne = (id) => $.ajax({
        url: `/admin-api/reward/detail/${id}`,
        method: 'GET',
    });
    Api.Reward.Update = (id, data) => $.ajax({
        url: `/admin-api/reward/update/${id}`,
        method: 'PUT',
        'data': JSON.stringify(data),
        'processData': false,
        'contentType': 'application/json'
    });
    Api.Reward.Delete = (id) => $.ajax({
        url: `/admin-api/reward/delete/${id}`,
        method: 'DELETE',
    });

    // Statistics apis
    Api.Statistics.GetLine = (data) => $.ajax({
        url: `/admin-api/statistics/line`,
        method: 'GET',
        'data':data,
    });

    Api.Statistics.GetSummaryPie = (data) => $.ajax({
        url: `/admin-api/statistics/summarypie`,
        method: 'GET',
    });

})();
