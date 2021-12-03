const View = {
    filter: {
        searchBy: 'keyword',
        keyword: {
            get val() {
                return $('.filter-search').val();
            },
            set val(v) {
                $('.filter-search').val(v);
            }
        },
        status: {
            get val() {
                return $('.filter-status').val();
            },
            set val(v) {
                $('.filter-status').val(v);
            }
        },
        action: {
            onApply(callback){
                $(document).on('click', '.filter-apply-btn', function() {
                    callback();
                });
            },
            onReset(callback){
                $(document).on('click', '.filter-reset-btn', function() {
                    callback();
                });
            }
        },
        reset: {
            isOn(){
                $('.remove-all-filter').addClass('is-open')
                $('.filters-toggle-btn').addClass('is-on')
            },
            isOff(){
                $('.remove-all-filter').removeClass('is-open')
                $('.filters-toggle-btn').removeClass('is-on')
            },
            onClick(name, callback) {
                $(document).on('click', '.remove-all-filter', function() {
                    if($(this).attr('atr').trim() == name) {
                        callback();
                    }
                });
            }
        },
        setFilterDefaul(){
            View.filter.status.val = '';
            View.filter.keyword.val = '';
        },
        init(){
            View.filter.status.val = '';
        }
    },

    table: {
        // private
        __resource: '#data-table',
        __table: null,
        __rows: [],
        __selected: {},
        __paginationList: [10, 20, 50, 100],
        __barge: {
            'active' : "success",
            'inactive' : "warning",
            'suspend' : "danger",
        },
        __bargeText: {
            'active' : "Active",
            'inactive' : "Inactive",
            'suspend' : "Suspend",
        },
        __generateDTRow(data, k) {
            const checked = this.__selected[data._id] ? 'checked' : '';
            var status_push = data.status == "active" ? "inactive" : "active";
            console.log("data???",data);
            return [
                data._id,
                `<input type="checkbox" class="form-control" style="min-height:20px;box-shadow:none;" ${checked}>`,
                (View.table.pagination.pageSize * (View.table.pagination.page-1)) + k + 1,
                data.name,
                data.company_id.name,
                new Date(data.createdAt).toLocaleString(),
                `<div class="d-flex align-items-center relative" data-id="${data._id}">
                    <div class="badge badge-${this.__barge[data.status]} badge-dot m-r-10"></div>
                    <div class="status_name" data-status-change="${status_push}">${this.__bargeText[data.status]}</div>
                </div>`,
                `<div class="d-flex align-items-center" data-id="${data._id}">
                    ${data.status == 'suspend' ? '' : `<div class="row-action bg-hover m-r-10" atr="Update Status"><i class="anticon anticon-sync"></i></div>`}
                    <div class="row-action bg-hover m-r-10" style="cursor: pointer" atr="Detail"><i class="anticon anticon-caret-down"></i></div>
                    <div class="row-action bg-hover m-r-10" style="cursor: pointer" atr="View" data-toggle="modal" data-target="#exampleModal"><i class="anticon anticon-edit"></i></div>
                    <div class="row-action bg-hover" style="cursor: pointer" atr="Delete" data-toggle="modal" data-target="#exampleModal"><i class="anticon anticon-delete"></i></div>
                </div>
                `,
            ];
        },
        // public
        pagination: {
            page: 1,
            pageSize: 10,
            total: 0,
            onChange(callback) {
                const oThis = this;
                $(document).on('click', '#data-table_wrapper .paginate_button.page-item:not(.disabled, .active)', function () {
                    const page = $(this).text();
                    let nextPage = null;
                    if (page.match(/Next/g)) {
                        nextPage = oThis.page + 1;
                    }
                    else if (page.match(/Previous/g)) {
                        nextPage = oThis.page - 1;
                    }
                    else {
                        nextPage = +page;
                    }
                    // callback first
                    callback(+nextPage);
                    // page change after
                    oThis.page = +nextPage;
                });
            },
            length(){
                return Math.ceil(this.total / this.pageSize);
            },
            render() {
                const paginationHTML = generatePagination(this.page, Math.ceil(this.total / this.pageSize));
                if($('.paging_simple_numbers').length) {
                    $('.paging_simple_numbers').remove();
                }
                $('#data-table_wrapper .dataTables_info').parent().parent().find('.col-sm-12.col-md-7').append(paginationHTML);
                const startEntry = this.pageSize * (this.page - 1) + 1;
                const lastEntry = Math.min(this.pageSize * this.page, this.total);
                $('#data-table_info').text(`Showing ${startEntry} to ${lastEntry} of ${this.total} entries`);
            }
        },
        pageSize:{
            get val() {
                return $('.pagination-page').val();
            },
            set val(v) {
                $('.pagination-page').val(v);
            },
            onChange(callback){
                $(document).on('change', '.pagination-page', function() {
                    callback($(this));
                });
            },
            init(){
                $('.multi-action-wrapper').prepend(
                    `<select class="custom-select form-control m-r-10 pagination-page" atr="Pagination Page">`+
                        View.table.__paginationList.map(v =>`<option value=${v}>${v}</option>`).join('')
                    +`</select>`
                )
                this.val = View.table.pagination.pageSize;
            }
        },
        listRows() {
            return this.__rows;
        },
        getRow(id) {
            return this.__rows[id];
        },
        insertRow(data, k) {
            const dtRow = this.__generateDTRow(data, k);
            this.__table.row.add(dtRow);
            this.__rows.push(data);
        },
        updateRow(id, data) {
            if(data) {
                this.__rows[id] = data;
            }
            const dtRow = this.__generateDTRow(this.__rows[id], id);
            this.__table.row($(`#data-table tbody tr:eq(${id})`)[0]).data(dtRow);
        },
        deleteRow(id) {},
        clearRows() {
            this.__table.clear();
            this.__rows = [];
        },
        reloadTable(){ },
        listSelectedRows() {
            const result = [];
            for(const [id, v] of Object.entries(this.__selected)) {
                result.push(v);
            }
            return result;
        },
        listSelectedIndexes() {
            const result = [];
            for(const [rowidx, rowData] of this.__rows.entries()) {
                if(this.__selected[rowData.id]) {
                    result.push(rowidx);
                }
            }
            return result;
        },
        unselectAll() {
            this.__selected = {};
            for(let i = 0; i < this.__rows.length; i++) {
                this.updateRow(i);
            }
            this.__table.draw();
        },
        onRowUpdateStatus(name, callback){
            $(document).on('click', '.row-action', function() {
                if($(this).attr('atr').trim() == name) {
                    callback($(this));
                }
            });
        },
        render() {
            this.__table.draw();
            this.pagination.render();
            const nrSelected = Object.keys(this.__selected).length;
            const textNrSelected = nrSelected == 0 ? ' 0 ' : ' ' + nrSelected + ' ';
            $('.data-table-selected-dropdown > button > .number-selected').text(textNrSelected);
            if (nrSelected == 0) {
                $('.data-table-selected-dropdown > button').attr('disabled', true);
            }
            else {
                $('.data-table-selected-dropdown > button').attr('disabled', false);
            }

            if($('#data-table tbody input[type="checkbox"]:checked').length == 0) {
                $('#data-table thead input[type="checkbox"]').prop('checked', false);
                $('#data-table tfoot input[type="checkbox"]').prop('checked', false);
            }
            else {
                if($('#data-table tbody input[type="checkbox"]:checked').length == Object.keys(this.__rows).length) {
                    $('#data-table thead input[type="checkbox"]').prop('checked', true);
                } else {
                    $('#data-table thead input[type="checkbox"]').prop('checked', false);
                }
                $('#data-table tfoot input[type="checkbox"]').prop('checked', true);
            }

            // check no data
            $('.dataTables_empty').html(`<img class="" style="width: 50%" src="assets/images/artboard_empty.jpeg" alt="Logo">`)
        },
        getRowIDWithTitle(data){
            for (var i = 0; i < View.table.__rows.length; i++) {
                if (View.table.__table.row(i).data()[0] == data) return i;
            }
        },
        SubTable:{
            render(tr, row, data){
                if ( row.child.isShown() ) {
                    row.child.hide();
                    tr.removeClass('shown');
                } else {
                    row.child( `
                        <div class="sub_table" style="background-color: #3f87f521;">
                            <table class="table table-condensed">
                                <thead>
                                    <tr>
                                        <th>No.</th>
                                        <th>Name </th>
                                        <th>Description</th>
                                        <th>Quantity</th>
                                        <th>Price</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${
                                        data.map((v, k) => {
                                            return `
                                                <tr>
                                                    <td>${k+1}</td>
                                                    <td>${v.metadata.name}</td>
                                                    <td>${v.description}</td>
                                                    <td>${v.quantity}</td>
                                                    <td>${v.price}</td>
                                                </tr> `
                                        }).join('')
                                    }
                                </tbody>
                            </table>
                        </div>`).show();
                    tr.addClass('shown');
                }
            },
            onAction(name, callback){
                $(`${View.table.__resource} tbody`).on('click', 'td .row-action', function () {
                    if($(this).attr('atr').trim() == name) {
                        var company_id = $(this).parent().attr('data-id')
                        var tr = $(this).closest('tr');
                        var row = View.table.__table.row( tr );
                        callback(tr, row, company_id);
                    }
                } );
            },
        },
        onBulkAction(name, callback) {
            $(document).on('click', '.dropdown .drop-action', function() {
                if($(this).text().trim() == name) {
                    const listRowIndex = View.table.listSelectedRows();
                    callback(listRowIndex);
                }
            });
        },
        onAction(name, callback) {
            $(document).on('click', '.btn.dropdown-item:not([disabled])', function() {
                if($(this).text().trim() == name) {
                    const rowid = $(this).closest('tr').index();
                    callback(rowid);
                }
            });
        },
        onRowAction(name, callback) {
            $(document).on('click', '.row-action', function() {
                if($(this).attr('atr').trim() == name) {
                    const rowid = $(this).parent().attr('data-id');
                    callback(rowid);
                }
            });
        },
        onTableAction(name, callback) {
            $(document).on('click', '.all-table', function() {
                if($(this).attr('atr').trim() == name) {
                    const listRowIndex = View.table.listSelectedRows();
                    callback(listRowIndex);
                }
            });
        },
        onSearch(name, callback){
            $(document).on('click', '.btn-search', function() {
                if($(this).attr('atr').trim() == name) {
                    callback();
                }
            });
        },
        onKeySearch(callback){
            $(".filter-search").on('keyup', function (e) {
                if (e.key === 'Enter' || e.keyCode === 13) {
                    callback();
                }
            });
        },
        onMultiDelete(name, callback){
            $(document).on('click', '.multi-action-wrapper .btn-group', function() {
                if($(this).attr('atr').trim() == name) {
                    callback();
                }
            });
        },
        onCreate(name, callback){
            $(document).on('click', '.btn-create', function() {
                if($(this).attr('atr').trim() == name) {
                    callback();
                }
            });
        },
        updateColumn(id, data, index) {
            rowID =  View.table.getRowIDWithTitle(id)
            rowData = $(this.__resource).DataTable().row(rowID).data()[index]
            if (index == 6) {
                if (data == 'active') {
                    rowData =   `<div class="d-flex align-items-center relative" data-id="${id}">
                                    <div class="badge badge-success badge-dot m-r-10"></div>
                                    <div class="status_name" data-status-change="inactive">Active</div>
                                </div>`
                }else{
                    rowData =   `<div class="d-flex align-items-center relative" data-id="${id}">
                                    <div class="badge badge-warning badge-dot m-r-10"></div>
                                    <div class="status_name" data-status-change="active">Inactive</div>
                                </div>`
                }
            }else if (index == 2){
                rowData = data
            }
            View.table.__table.row(rowID).data()[index] = rowData;
            $(this.__resource).dataTable().fnUpdate(View.table.__table.row(rowID).data(), rowID, undefined,false);
        },
        init() {
            this.__table = $('#data-table').DataTable({
                colReorder: true,
                // fixedHeader: true,
                columns: [
                    {
                        title: 'ID',
                        name: 'id',
                        orderable: false,
                        visible: false,
                    },
                    {
                        title: '<input type="checkbox" class="form-control" style="min-height:20px;box-shadow:none;">',
                        name: 'checkbox',
                        orderable: false,
                        width: '5%',
                    },
                    {
                        title: 'No.',
                        name: 'index',
                        orderable: true,
                        width: '5%',
                    },
                    {
                        title: 'Name',
                        name: 'name',
                        orderable: true,
                    },
                    {
                        title: 'Company',
                        name: 'own_address',
                        orderable: false,
                    },
                    {
                        title: 'Create at',
                        name: 'price',
                        orderable: false,
                    },
                    {
                        title: 'Status',
                        name: 'status',
                        orderable: false,
                        width: '13%',
                    },
                    {
                        title: 'Action',
                        // className : 'd-flex',
                        // data      : null,
                        // defaultContent: ``,
                        orderable : false,
                        width       : '10%',
                    },
                ],
                lengthChange: false,
                searching: false,
                paging: false,
                autoWidth: false,
                order: [],
            });
            $('.table.dataTable ').parent().css({
                'overflow-x': 'scroll'
            })

            $(`${this.__resource} tbody`).on('click', 'td .details-control', function () {
                    var tr = $(this).closest('tr');
                    var row = View.table.__table.row( tr );
                    
                    if ( row.child.isShown() ) {
                        row.child.hide();
                        tr.removeClass('shown');
                    } else {
                        row.child( `
                            <div class="sub_table">
                                <table class="table table-condensed">
                                    <thead>
                                        <tr>
                                            <th>No.</th>
                                            <th>Name </th>
                                            <th>Description</th>
                                            <th>Quantity</th>
                                            <th>Price</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody></tbody>
                                </table>
                            </div>`).show();
                        tr.addClass('shown');
                    }
            } );


            View.table.pageSize.init();
            const oThis = this;
            $(document).on('change', '#data-table thead input[type="checkbox"]', function() {
                const checked = $(this).is(':checked');
                for(let i = 0; i < oThis.__rows.length; i++) {
                    const rowSelected = !!oThis.__selected[oThis.__rows[i]._id];
                    if(rowSelected != checked) {
                        if(checked) {
                            oThis.__selected[oThis.__rows[i]._id] = oThis.__rows[i];
                        }
                        else {
                            delete oThis.__selected[oThis.__rows[i]._id];
                        }
                        oThis.updateRow(i);
                    }
                }
                oThis.render();
            });
            $(document).on('change', '#data-table tfoot input[type="checkbox"]', function() {
                const checked = $(this).is(':checked');
                for(let i = 0; i < oThis.__rows.length; i++) {
                    const rowSelected = !!oThis.__selected[oThis.__rows[i]._id];
                    if(rowSelected != checked) {
                        if(checked) {
                            oThis.__selected[oThis.__rows[i]._id] = oThis.__rows[i];
                        }
                        else {
                            delete oThis.__selected[oThis.__rows[i]._id];
                        }
                        oThis.updateRow(i);
                    }
                }
                oThis.render();
            });
            $(document).on('change', '#data-table tbody input[type="checkbox"]', function() {
                const rowid = $(this).closest('tr').index();
                const checked = $(this).is(':checked');
                if(checked) {
                    oThis.__selected[oThis.__rows[rowid]._id] = oThis.__rows[rowid];
                }
                else {
                    delete oThis.__selected[oThis.__rows[rowid]._id];
                }
                oThis.updateRow(rowid);
                oThis.render();
            });
        }
    },
    selectedAction: {
        searchItem: null,
        selectedMap: [
            'Address',
            'Status',
        ],
        onSelect(callback){
            $(document).on('click', '.selectedAction .dropdown-item', function() {
                callback($(this))
            });
        },
        setSearch(data){
            View.selectedAction.searchItem = data;
            $('.search-select .search-selected').text(data)
        },
        init(){
            View.selectedAction.setSearch('Address');
            // render dropdown action
            $('.selectedAction .dropdown-item').remove()
            for (var selected of this.selectedMap) {
                $('.selectedAction').append(`<a class="dropdown-item drop-action" href="#">${selected}</a>`)
            }
        },
    },
    dateRangePicker: {
        init(){
            $('.daterangepicker-input').daterangepicker();
        }
    },
    helper: {
        showToastSuccess(title, message) {
            $('#notification-sending').remove();
            var toastHTML = `<div class="notification notification-success alert-success ">
                                <div class="d-flex align-items-center justify-content-start">
                                    <span class="alert-icon">
                                        <i class="anticon anticon-check-o"></i>
                                    </span>
                                    <span>${message}</span>
                                </div>
                            </div>`
            $(document).on('click', '#notification-success .alert', function () {
                $(this).remove();
            })
            $('#notification-success').append(toastHTML)
            setTimeout(function () {
                $('#notification-success .notification:first-child').remove();
            }, 2000);
        },
        showToastError(title, message) {
            $('#notification-sending').remove();
            var toastHTML = `<div class="notification notification-error alert-danger ">
                                <div class="d-flex align-items-center justify-content-start">
                                    <span class="alert-icon">
                                        <i class="anticon anticon-check-o"></i>
                                    </span>
                                    <span>${message}</span>
                                </div>
                            </div>`
            $('#notification-error').append(toastHTML)
            setTimeout(function () {
                $('#notification-error .notification:first-child').remove();
            }, 2000);
        },
        showToastProcessing(title, message) {
            var toastHTML = `<div class="notification notification-processing alert-primary">
                                <div class="d-flex align-items-center justify-content-start">
                                    <span class=" alert-icon">
                                        <i class="anticon anticon-loading"></i>
                                    </span>
                                    <span>${message}</span>
                                </div>
                            </div>`
            $('#notification-sending').append(toastHTML)
        },
    },
    image: {
        init(){
            $('#file_meta').val('')
            $(document).on('change', '#file_meta', function(e) {
                if(this.files[0].size > 5242880){
                   alert("File quá lớn, dung lượng upload tối đa 5 MB!");
                }else{
                    $('.image-selected').find('.image-wrapper').remove()
                    $('.image-selected').append(`<div class="image-wrapper"></div>`)
                    
                    var img = new Image;
                    img.src = URL.createObjectURL(e.target.files[0]);
                    console.log(URL.createObjectURL(e.target.files[0]));
                    img.onload = function() {
                        $('.image-wrapper').css({
                            'background-image' : `url('${URL.createObjectURL(e.target.files[0])}')`
                        })
                    }
                }
            });
        }
    },
    modals: {
        CreateUser: {
            resource: '#collection-create',
            listNFT: [],
            show(){
                $(`${this.resource}`).modal(true);
            },
            hide() {
                $(`${this.resource}`).modal('hide');
            },
            setDefaul(){

            },
            setCategory(data){
                data.map(v => {
                    $('.data-category').append(`<option value="${v.value}">${v.title}</option>`)
                }) 
            },
            setVal(data){
                $(`${this.resource}`).find('.modal-title').html(`Collection create`);
                $('.data-company').append(`<option value="">----------</option>`)
                data.map(v => {
                    $('.data-company').append(`<option value="${v._id}">${v.name ?? "-"}</option>`)
                })
            },
            getVal(){ },
            unbindAll() {
                $(document).off('click', `${this.resource} .modal-action`);
            },
            onPush(name, callback) {
                $(document).on('click', `${this.resource} .modal-action`, function() {
                    if($(this).attr('atr').trim() == name) {
                        callback();
                    }
                });
            },
            onCompanyChange(name, callback){
                $(document).on('change', `.data-company`, function() {
                    if($(this).attr('atr').trim() == name) {
                        if ($(this).val() != ''){
                            callback($(this).val());
                        }else{
                            View.modals.CreateUser.DeleteAllNFT();
                            View.modals.CreateUser.checkButtonCreate()
                        }
                    }
                });
            },
            checkButtonCreate(){
                if ($('.ntf-item').length == 4) {
                    $('.create_nft').remove();
                }else{
                    if ($('.create_nft').length == 0) 
                        $('.create-nft-wrapper').append(`
                            <div class="create_nft" atr="Create NFT">
                                <i class="fas fa-plus"></i>
                            </div> 
                        `)
                }
            },
            onCreateNFT(name, callback){
                $(document).on('click', `.create_nft`, function() {
                    if($(this).attr('atr').trim() == name) {
                        callback();
                    }
                });
            },
            onRemoveNFT(name, callback){
                $(document).on('click', `.delete_nft`, function() {
                    if($(this).attr('atr').trim() == name) {
                        callback($(this));
                    }
                });
            },
            getNFTVisible(){
                var list_nft_selected = []
                $('.data-nft-select').each(function( index ) {
                    if ($(this).val()) list_nft_selected.push($(this).val())
                });
                return View.modals.CreateUser.listNFT.filter(
                    function(e) {
                        return this.indexOf(e._id) < 0;
                    },
                    list_nft_selected
                );
            },
            onSelect(callback){
                $(document).on('focus', `${this.resource} .data-nft-select`, function() {
                    var nft_list = View.modals.CreateUser.getNFTVisible()
                    console.log(nft_list);
                    $(this).find(`option:not([value="${$(this).val()}"])`).remove();
                    nft_list.map(v => {
                        $(this).append(`<option value="${v._id}" nft-name="${v.metadata.name}">${v.metadata.name}</option>`)
                    })
                    callback();
                });
            },
            RenderNFT(item){
                $('.ntf-select').append(`
                    <div class="ntf-item">
                        <select class="form-control data-nft-select">
                        </select>
                        <div class="item-remove delete_nft" atr="Delete NFT">
                            <i class="fas fa-times"></i>
                        </div>
                    </div>
                `)
            },
            DeleteNFT(item){
                item.parent().remove()
            },
            DeleteAllNFT(){
                $('.ntf-item').remove()
            },
            onPush(name, callback) {
                var resource = this.resource;
                $(document).on('click', `${this.resource} .modal-action`, function() {
                    if($(this).attr('atr').trim() == name) {
                        $('.js-errors').find('.error').remove()
                        var fd = new FormData();
                        var files = $('#file_meta')[0].files;
                        var list_nft_selected = []
                        $(`${resource} .data-nft-select`).each(function( index ) {
                            if ($(this).val()) list_nft_selected.push($(this).val())
                        });
                        var onPushData = true;

                        var name_collection = $(`${resource}`).find('.data-name').val()
                        var company_id = $(`${resource}`).find('.data-company').val()
                        var nft_id = list_nft_selected.length

                        if (name_collection == null) { $('.js-errors').append(`<li class="error">Name is required</li>`); onPushData = false }
                        if (company_id == 0) { $('.js-errors').append(`<li class="error">Company is required</li>`); onPushData = false }
                        if (nft_id == 0) { $('.js-errors').append(`<li class="error">Select nft</li>`); onPushData = false }
                        if (files.length <= 0) { $('.js-errors').append(`<li class="error">Please select a file.</li>`); onPushData = false }

                        if (onPushData) {
                            fd.append('file', files[0]);
                            fd.append('name', name_collection);
                            fd.append('company_id', company_id);
                            fd.append('category', JSON.stringify($(`${resource}`).find('.data-category').val()));
                            fd.append('nft_id', JSON.stringify(list_nft_selected));
                            callback(fd);
                        }
                    }
                });
            },
            init() {
                $(`${this.resource} .modal-body`).html(`
                    <ul class="js-errors"></ul>
                    <div class="row">
                        <div class="col-xs-12 col-sm-12 col-md-6 col-lg-6 col-xl-6">
                            <div class="form-group">
                                <label for="name">Name:</label>
                                <input type="text" min="0" class="form-control data-name" id="name" placeholder="Name">
                            </div>
                            <div class="form-group category-group">
                                <label>Category:</label>
                                <select class="form-control data-category" id="category" multiple="multiple">
                                </select>
                            </div>
                            <div class="form-group image-selected">
                                <label>Cover Image:</label>
                                <input type="file" class="form-control data-cover-image" id="file_meta" accept="image/*">
                                
                            </div>
                        </div>
                        <div class="col-xs-12 col-sm-12 col-md-6 col-lg-6 col-xl-6">
                            <div class="form-group">
                                <label for="company">Company:</label>
                                <select class="form-control data-company" id="company" atr="Company">
                                </select>
                            </div>
                            <div class="form-group create-nft-wrapper">
                                <label for="">NTF select:</label>
                                <div class="ntf-select">
                                </div>
                                <div class="create_nft" atr="Create NFT">
                                    <i class="fas fa-plus"></i>
                                </div>                      
                            </div>  
                        </div>
                    </div>
                `);
                $('.data-category').select2({
                    templateSelection: function (data, container) {
                        $(data.element).attr('data-custom-attribute', data.customValue);
                        return data.text;
                    }
                })
            }
        },
        UpdateUser: {
            resource: '#collection-update',
            listNFT: [],
            show(){
                $(`${this.resource}`).modal(true);
            },
            hide() {
                $(`${this.resource}`).modal('hide');
            },
            setDefaul(){

            },
            setCategory(data){
                data.map(v => {
                    $('.data-category').append(`<option value="${v.value}">${v.title}</option>`)
                }) 
            },
            setVal(data, data_value){
                $(`${this.resource}`).find('.modal-title').html(`<i class="anticon anticon-info-circle m-r-5"></i> Collection Update`);

                data.map(v => {
                    if (v._id == data_value.company_id._id) 
                        $('.data-company').append(`<option value="${v._id}">${v.name ?? "-"}</option>`)
                })
                $('.data-name').val(data_value.name)
                $('.data-company').val(data_value.company_id._id)
                $('.image-selected').append(`<div class="image-wrapper" style="background-image: url(${data_value.cover_image});"></div>`)
                data_value.category.map(v => {
                    $('.category-group').append(`<div class="badge badge-pill badge-primary m-r-5 m-b-5">${v}</div>`)
                })
                data_value.nft.map(v => {
                    $('.ntf-select').append(`
                        <div class="ntf-item">
                            <select class="form-control data-nft-select"><option  value="${v._id}">${v.metadata.name}</option></select>
                            <div class="item-remove delete_nft" atr="Update Delete NFT">
                                <i class="fas fa-times"></i>
                            </div>
                        </div>
                    `)
                })

            },
            getVal(){ 
                var list_nft_selected = []
                $(`${this.resource} .data-nft-select`).each(function( index ) {
                    if ($(this).val()) list_nft_selected.push($(this).val())
                });
                return {
                    name: $('.data-name').val(),
                    nft_id: JSON.stringify(list_nft_selected),
                }
            },
            onCompanyChange(name, callback){
                $(document).on('change', `.data-company`, function() {
                    if($(this).attr('atr').trim() == name) {
                        if ($(this).val() != ''){
                            callback($(this).val());
                        }else{
                            View.modals.UpdateUser.DeleteAllNFT();
                            // View.modals.UpdateUser.checkButtonCreate()
                        }
                    }
                });
            },
            checkButtonCreate(){
                if ($('.ntf-item').length == 4) {
                    $('.create_nft').remove();
                }else{
                    if ($('.create_nft').length == 0) 
                        $('.create-nft-wrapper').append(`
                            <div class="create_nft" atr="Create NFT">
                                <i class="fas fa-plus"></i>
                            </div> 
                        `)
                }
            },
            onCreateNFT(name, callback){
                $(document).on('click', `${View.modals.UpdateUser.resource} .create_nft`, function() {
                    if($(this).attr('atr').trim() == name) {
                        callback();
                    }
                });
            },
            onRemoveNFT(name, callback){
                $(document).on('click', `${View.modals.UpdateUser.resource} .delete_nft`, function() {
                    if($(this).attr('atr').trim() == name) {
                        callback($(this));
                    }
                });
            },
            getNFTVisible(){
                var list_nft_selected = []

                $('.data-nft-select').each(function( index ) {
                    if ($(this).val()) list_nft_selected.push($(this).val())
                });
                return View.modals.UpdateUser.listNFT.filter(
                    function(e) {
                        return this.indexOf(e._id) < 0;
                    },
                    list_nft_selected
                );
            },
            unbindAll() {
                $(document).off('click', `${this.resource} .modal-action`);
            },
            onSelect(callback){
                $(document).on('focus', `${this.resource} .data-nft-select`, function() {
                    var nft_list = View.modals.UpdateUser.getNFTVisible()

                    $(this).find(`option:not([value="${$(this).val()}"])`).remove();
                    nft_list.map(v => {
                        $(this).append(`<option value="${v._id}" nft-name="${v.metadata.name}">${v.metadata.name}</option>`)
                    })
                    callback();
                });
            },
            onPushUpdate(name, callback) {
                $(document).on('click', `${this.resource} .modal-action`, function() {
                    if($(this).attr('atr').trim() == name) {
                        callback();
                    }
                });
            },
            RenderNFT(item){
                $('.ntf-select').append(`
                    <div class="ntf-item">
                        <select class="form-control data-nft-select">
                        </select>
                        <div class="item-remove delete_nft" atr="Delete NFT">
                            <i class="fas fa-times"></i>
                        </div>
                    </div>
                `)
            },
            init() {
                $(`${this.resource} .modal-body`).html(`
                    <ul class="js-errors"></ul>
                    <div class="row">
                        <div class="col-xs-12 col-sm-12 col-md-6 col-lg-6 col-xl-6">
                            <div class="form-group">
                                <label for="name">Name:</label>
                                <input type="text" min="0" class="form-control data-name" id="name" placeholder="Name" >
                            </div>
                            <div class="form-group category-group">
                                <label>Category:</label>
                            </div>
                            <div class="form-group image-selected">
                                <label>Cover Image:</label>
                            </div>
                        </div>
                        <div class="col-xs-12 col-sm-12 col-md-6 col-lg-6 col-xl-6">
                            <div class="form-group">
                                <label for="company">Company:</label>
                                <select class="form-control data-company" id="company" atr="Company" disabled>
                                </select>
                            </div>
                            <div class="form-group create-nft-wrapper">
                                <label for="">NTF select:</label>
                                <div class="ntf-select">
                                </div>                
                            </div>  
                        </div>
                    </div>
                `);
                $('.data-category').select2({
                    templateSelection: function (data, container) {
                        $(data.element).attr('data-custom-attribute', data.customValue);
                        return data.text;
                    }
                })
            }
        },
        UpdateStatus: {
            resource: '#user-status-update',
            show(){
                $(`${this.resource}`).modal(true);
            },
            hide() {
                $(`${this.resource}`).modal('hide');
            },
            setDefaul(){ },
            setVal(){
                $(`${this.resource}`).find('.modal-title').html(`Update status`);
            },
            getVal(){
                return {

                }
            },
            unbindAll() {
                $(document).off('click', `${this.resource} .modal-action`);
            },
            onPush(name, callback) {
                $(document).on('click', `${this.resource} .modal-action`, function() {
                    if($(this).attr('atr').trim() == name) {
                        callback();
                    }
                });
            },
            init() {

            }
        },
        DeleteOneUser: {
            resource: '#user-delete',
            show(){
                $(`${this.resource}`).modal(true);
            },
            hide() {
                $(`${this.resource}`).modal('hide');
            },
            setDefaul(){

            },
            setVal(){
                $(`${this.resource}`).find('.modal-title').html(`Delete collection`);
            },
            getVal(){
                return {

                }
            },
            unbindAll() {
                $(document).off('click', `${this.resource} .modal-action`);
            },
            onPush(name, callback) {
                $(document).on('click', `${this.resource} .modal-action`, function() {
                    if($(this).attr('atr').trim() == name) {
                        callback();
                    }
                });
            },
            init() {

            }
        },
        DeleteUser: {
            resource: '#user-delete',
            show(){
                $(`${this.resource}`).modal(true);
            },
            hide() {
                $(`${this.resource}`).modal('hide');
            },
            setDefaul(){ },
            setVal(data){
                $(`${this.resource}`).find('.modal-title').html(`Delete ${data} user`);
            },
            getVal(){
                return {

                }
            },
            unbindAll() {
                $(document).off('click', `${this.resource} .modal-action`);
            },
            onPush(name, callback) {
                $(document).on('click', `${this.resource} .modal-action`, function() {
                    if($(this).attr('atr').trim() == name) {
                        callback();
                    }
                });
            },
            init() {

            }
        },
        init() {
            this.DeleteUser.init();
        }
    },
    configTime(time){
            // truyền vào 18/6/2021 -> 2021-6-18
        return time.split('/')[2] + '-' + ('0' + time.split('/')[1]).slice(-2) + '-' + ('0' + time.split('/')[0]).slice(-2)
    },
    init() {
        this.image.init();
        this.table.init();
        this.modals.init();
        this.filter.init();
        this.dateRangePicker.init();
        View.selectedAction.init();
    }
};
(() => {
    View.init();

    const loadOrders = (res) => {
        View.table.clearRows();
        View.table.pagination.total = res.data.headers['x-total-count'];
        View.table.render();
        res.data.items.map((v, k) => {
            View.table.insertRow(v, k);
        })
        View.table.render();
    };

    View.table.SubTable.onAction('Detail', (tr, row, company_id) => {
        Api.Collection.GetOne(company_id)
            .done(res => {
                View.table.SubTable.render(tr, row, res.data.nft)
            });
    })

    View.table.pagination.onChange((page) => {
        View.table.pagination.page = +page;
        View.table.render();
        LoadData();
    })

    View.table.pageSize.onChange((item) => {
        View.table.pagination.pageSize = item.val();
        View.table.pagination.page = 1;
        View.table.render();
        LoadData();
    })

    View.table.onSearch("Search", () => {
        LoadData();
    })
    View.table.onKeySearch(() => {
        LoadData();
    })

    View.filter.reset.onClick("Remove Filter", () => {
        View.filter.setFilterDefaul();
        View.filter.reset.isOff();
        LoadData();
    })
    View.filter.action.onApply(() => {
        $('#quick-view').modal('hide');
        LoadData();
    })
    View.filter.action.onReset(() => {
        $('#quick-view').modal('hide');
        View.filter.setFilterDefaul();
        View.filter.reset.isOff();
        LoadData();
    })

    // CREATE module
    View.table.onCreate("Create", () => {
        View.modals.CreateUser.init();
        View.modals.CreateUser.show();
        Api.Category.Get()
            .done(res => {
                View.modals.CreateUser.setCategory(res.data)
            })
            .fail(err => {
                View.helper.showToastError('Error', 'Something Wrong'); 
            })
            .always(() => {
            });
        Api.Company.GetAll()
            .done(res => {
                View.modals.CreateUser.setVal(res.data.items);
                View.modals.CreateUser.unbindAll();
                View.modals.CreateUser.onPush("Save", (item) => {
                    Api.Collection.Create(item)
                        .done(res => {
                            View.modals.CreateUser.hide();
                            LoadData();
                        })
                        .fail(err => {
                            View.helper.showToastError('Error', 'Something Wrong'); 
                        })
                        .always(() => {
                        });
                });

            })
            .fail(err => {
                View.helper.showToastError('Error', 'Something Wrong'); 
            })
            .always(() => {
            });
    })
    View.modals.CreateUser.onCompanyChange('Company', (item) => {
        View.modals.CreateUser.listNFT = [];
        View.modals.CreateUser.DeleteAllNFT();
        View.modals.CreateUser.checkButtonCreate();
        Api.Collection.GetNFT(item)
            .done(res => {
                $('.js-errors').find('.nft-error').remove()
                if (res.data == null) {
                    $('.js-errors').append(`<li class="error nft-error">no NFTs is available</li>`);
                }else{
                    res.data.items.map(v => {
                        View.modals.CreateUser.listNFT.push(v)
                    })
                }
            })
            .fail(err => {
                View.helper.showToastError('Error', 'Something Wrong'); 
            })
            .always(() => {
            });
    })
    View.modals.CreateUser.onCreateNFT('Create NFT', (item) => {
        var has_company = View.modals.CreateUser.listNFT.length == 0 ? false : true;
        var has_nft     = true;
        var nft_visible = View.modals.CreateUser.getNFTVisible().length > 0 ? true : false;

        $('.data-nft-select').each(function( index ) {
            if ($(this).val() == null ) has_nft = false
        });
        if (has_company && has_nft && nft_visible) {
            View.modals.CreateUser.RenderNFT()
            View.modals.CreateUser.checkButtonCreate()
        }
    })
    View.modals.CreateUser.onRemoveNFT('Delete NFT', (item) => {
        View.modals.CreateUser.DeleteNFT(item)
        View.modals.CreateUser.checkButtonCreate()
    })
    View.modals.CreateUser.onSelect(() => { })

    // UPDATE status on one collection
    View.table.onRowUpdateStatus("Update Status", (item) => {
        var id = item.parent().attr('data-id')
        var status = item.parent().parent().parent().find('.status_name').attr('data-status-change')
        data = {
            status: status,
        }

        View.modals.UpdateStatus.show();
        View.modals.UpdateStatus.setVal();
        View.modals.UpdateStatus.unbindAll();
        View.modals.UpdateStatus.onPush("Save", () => {
            View.helper.showToastProcessing('Processing', 'Update status !');
            View.modals.UpdateStatus.hide();
            Api.Collection.UpdateStatus(id, data)
                .done(res => {
                    View.helper.showToastSuccess('Success', 'Update successful'); 
                    View.table.updateColumn(id, status, 6)
                })
                .fail(err => {
                    View.helper.showToastError('Error', 'Something Wrong'); 
                })
                .always(() => {
                });
        });
    })

    // EDIT module
    View.table.onRowAction("View", (id) => {
        Api.Collection.GetOne(id)
            .done(res => {
                var data_collection = res.data;
                View.modals.UpdateUser.init();
                View.modals.UpdateUser.show();

                Api.Collection.GetNFT(res.data.company_id._id)
                    .done(res => {
                        View.modals.UpdateUser.listNFT = []

                        // if (res.data == null) {
                        //     $('.js-errors').append(`<li class="error nft-error">no NFTs is available</li>`);
                        // }else{
                            $('.js-errors').find('.nft-error').remove()
                            res.data.items.map(v => {
                                View.modals.UpdateUser.listNFT.push(v)
                            })
                        // }
                    })
                    .fail(err => {
                        View.helper.showToastError('Error', 'Something Wrong'); 
                    })
                    .always(() => {
                    });
                Api.Category.Get()
                    .done(res => {
                        View.modals.UpdateUser.setCategory(res.data)
                    })
                    .fail(err => {
                        View.helper.showToastError('Error', 'Something Wrong'); 
                    })
                    .always(() => {
                    });
                Api.Company.GetAll()
                    .done(res => {
                        View.modals.UpdateUser.setVal(res.data.items, data_collection);
                        View.modals.UpdateUser.unbindAll();

                        View.modals.UpdateUser.onPushUpdate("Save Collection", () => {

                            Api.Collection.Update(id, View.modals.UpdateUser.getVal())
                                .done(res => {
                                    View.modals.UpdateUser.hide();
                                    LoadData();
                                })
                                .fail(err => {
                                    View.helper.showToastError('Error', 'Something Wrong'); 
                                })
                                .always(() => {
                                });
                        });
                    })
                    .fail(err => {
                        View.helper.showToastError('Error', 'Something Wrong'); 
                    })
                    .always(() => {
                    });

            })
            .fail(err => {
                View.helper.showToastError('Error', 'Something Wrong'); 
            })
            .always(() => {
            });
    })
    
    View.modals.UpdateUser.onSelect(() => { })
    View.modals.UpdateUser.onCreateNFT('Update Create NFT', (item) => {
        var has_company = View.modals.UpdateUser.listNFT.length == 0 ? false : true;
        var has_nft     = true;
        var nft_visible = View.modals.UpdateUser.getNFTVisible().length > 0 ? true : false;


        $('.data-nft-select').each(function( index ) {
            if ($(this).val() == null ) has_nft = false
        });
        if (has_company && has_nft && nft_visible) {
            View.modals.UpdateUser.RenderNFT()
            // View.modals.UpdateUser.checkButtonCreate()
        }
    })
    View.modals.UpdateUser.onRemoveNFT('Update Delete NFT', (item) => {
        View.modals.CreateUser.DeleteNFT(item)
        // View.modals.CreateUser.checkButtonCreate()
    })
    View.table.onRowAction("Delete", (id) => {
        View.modals.DeleteOneUser.show();
        View.modals.DeleteOneUser.setVal();
        View.modals.DeleteOneUser.unbindAll();
        View.modals.DeleteOneUser.onPush("Save", () => {
            View.helper.showToastProcessing('Processing', 'Delete !');
            Api.Collection.Delete(id)
                .done(res => {
                    View.helper.showToastSuccess('Success', 'Delete successful'); 
                    View.modals.DeleteOneUser.hide();
                    LoadData();
                })
                .fail(err => {
                    View.helper.showToastError('Error', 'Something Wrong'); 
                })
                .always(() => {
                });
        });
    })

    function LoadData(){
        var keyword = View.filter.keyword.val;
        var searchBy = View.filter.searchBy;
        var status = View.filter.status.val;

        status_data = status
        if (status == '') {
            status_data = ['active', 'inactive']
        }
        
        var filter = {
            'status'        : status_data
        }
        filter[`${searchBy}`] = keyword;

        if (keyword != '' || status != '') View.filter.reset.isOn();
        else View.filter.reset.isOff();

        Api.Collection.GetAll(View.table.pagination.page, View.table.pagination.pageSize, filter)
            .done(res => {
                loadOrders(res);
            });
    }
    LoadData();


})();

