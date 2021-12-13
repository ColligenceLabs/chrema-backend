const View = {
    filter: {
        searchBy: 'name',
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
            return [
                data._id,
                `<input type="checkbox" class="form-control" style="min-height:20px;box-shadow:none;" ${checked}>`,
                (View.table.pagination.pageSize * (View.table.pagination.page-1)) + k + 1,
                data.metadata == null ?  '-' : (data.metadata.name == null ? '-' : data.metadata.name),
                data.description == null ?  '-' : data.description,
                (data.selling == true ? `<span class="badge badge-pill badge-green m-b-5">On sale</span>` : `<span class="badge badge-pill badge-light m-b-5">Off sale</span>` )+ `<span class="badge badge-pill badge-magenta m-b-5">Total Mint: ${data.quantity}</span>
                <span class="badge badge-pill badge-geekblue m-b-5">Selling Quantity: ${data.quantity_selling}</span>`,
                data.company_id == null ?  '-' : (data.company_id.name == null ? data.company_id : data.company_id.name),
                `<div class="d-flex align-items-center relative" data-id="${data._id}">
                    <div class="badge badge-${this.__barge[data.status]} badge-dot m-r-10"></div>
                    <div class="status_name" data-status-change="${status_push}">${this.__bargeText[data.status]}</div>
                </div>`,
                `<label class="switch" data-status="${+!status.indexOf(data.selling_status)}" data-id="${data._id}"> <span class="slider round ${data.selling_status == '1' ? 'active' : ''}"></span> </label>`,
                `<span class="badge badge-pill badge-geekblue m-b-5">${data.start_date == null ? '-' : (new Date(data.start_date).toLocaleString())}</span>
                <span class="badge badge-pill badge-green">${data.end_date == null ? '-' : (new Date(data.end_date).toLocaleString())}</span>`,
                new Date(data.createdAt).toLocaleString(),
                `<div class="d-flex align-items-center" data-id="${data._id}">
                    ${data.status == 'suspend' ? '' : `<div class="row-action bg-hover m-r-10" atr="Update Status"><i class="anticon anticon-sync"></i></div>`}
                    <div class="row-action bg-hover m-r-10" style="cursor: pointer" atr="View" data-toggle="modal" data-target="#exampleModal"><i class="anticon anticon-eye"></i></div>
                    <div class="row-action bg-hover" style="cursor: pointer" atr="Delete" data-toggle="modal" data-target="#exampleModal"><i class="anticon anticon-delete"></i></div>
                </div> `,
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
            $('.dataTables_empty').html(`<img class="" style="width: 50%" src="/assets/images/artboard_empty.jpeg" alt="Logo">`)
        },
        getRowIDWithTitle(data){
            for (var i = 0; i < View.table.__rows.length; i++) {
                if (View.table.__table.row(i).data()[0] == data) return i;
            }
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
            if (index == 7) {
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
                        name: 'id',
                        orderable: true,
                    },
                    {
                        title: 'Name',
                        name: 'name',
                        orderable: true,
                        width: '15%',
                    },
                    {
                        title: 'Description',
                        name: 'description',
                        orderable: true,
                        width: '20%',
                    },
                    {
                        title: 'Selling Quantity',
                        name: 'selling_quantity',
                        orderable: true,
                        width: '15%',
                    },
                    {
                        title: 'Company',
                        name: 'company',
                        orderable: true,
                    },
                    {
                        title: 'Status',
                        name: 'status',
                        orderable: false,
                        width: '10%',
                    },
                    {
                        title: 'Stop Selling',
                        name: 'selling',
                        orderable: false,
                        width: '15%',
                    },
                    {
                        title: 'Sale Date',
                        name: 'start_date',
                        orderable: true,
                    },
                    {
                        title: 'Created at',
                        name: 'created_at',
                        orderable: true,
                        width: '20%',
                    },
                    {
                        title: 'Actions',
                        name: 'actions',
                        orderable: false,
                        width: '10%',
                    }
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
    onSwitch(callback){
        $(document).on('click', '.switch', function() {
            callback($(this));
        });
    },
    selectedAction: {
        searchItem: null,
        selectedMap: [
            'Set Schedule',
            'Delete',
        ],
        onAtrAction(name, callback) {
            $(document).on('click', '.selectedAction .drop-action', function() {
                if($(this).attr('atr').trim() == name) {
                    const listRowIndex = View.table.listSelectedRows();
                    callback(listRowIndex);
                }
            });
        },
        init(){
            // render dropdown action
            $('.selectedAction .dropdown-item').remove()
            for (var selected of this.selectedMap) {
                $('.selectedAction').append(`<a class="dropdown-item drop-action" href="#" atr="${selected}">${selected}</a>`)
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
    modals: {
        CreateProduct: {
            resource: '#product-create',
            show(){
                $(`${this.resource}`).modal(true);
            },
            hide() {
                $(`${this.resource}`).modal('hide');
            },
            setDefaul(){

            },
            setVal(data){
                console.log('res', data);
                $(`${this.resource}`).find('.modal-title').html(`Airdrop Mint`);
                data.data.items.map(v => {
                    $('.data-company').append(`<option value="${v._id}">${v.name}</option>`)
                })
            },
            getVal(){ },
            unbindAll() {
                $(document).off('click', `${this.resource} .modal-action`);
            },
            onPush(name, callback) {
                var resource = this.resource;
                $(document).on('click', `${this.resource} .modal-action`, function() {
                    if($(this).attr('atr').trim() == name) {
                        $('.js-errors').find('.error').remove()
                        var fd = new FormData();
                        var onPushData = true;

                        var files = $('#file_meta')[0].files;
                        var thumbnail = $('#thumbnail')[0].files;
                        var name_product  = $(`${resource}`).find('#name').val();
                        var quantity  = $(`${resource}`).find('#quantity').val();
                        // var rarity  = $(`${resource}`).find('#rarity').val();

                        var rarity = '';
                        if (quantity > 3001) {
                            rarity = 1;
                        } else if (quantity > 2000) {
                            rarity = 2;                            
                        } else if (quantity > 500) {
                            rarity = 3;
                        } else if (quantity > 1) {
                            rarity = 4;
                        } else if (quantity == 1) {
                            rarity = 5;
                        }

                        var description  = $(`${resource}`).find('#description').val();
                        var company_id  = $(`${resource}`).find('#company').val();

                        if (files.length <= 0) { $('.js-errors').append(`<li class="error">Please select a file.</li>`); onPushData = false }
                        if (name_product == '') { $('.js-errors').append(`<li class="error">Name is required</li>`); onPushData = false }
                        if (quantity == '') { $('.js-errors').append(`<li class="error">Quantity is required</li>`); onPushData = false }
                        if (rarity == '') { $('.js-errors').append(`<li class="error">Rarity is required</li>`); onPushData = false }
                        if (description == '') { $('.js-errors').append(`<li class="error">Description is required</li>`); onPushData = false }
                        if (company_id == '') { $('.js-errors').append(`<li class="error">Company is required</li>`); onPushData = false }

                        if (onPushData) {
                            fd.append('file', files[0]);
                            fd.append('thumbnail', thumbnail[0]);
                            fd.append('name', $('#name').val());
                            fd.append('type', 1);
                            fd.append('quantity', $('#quantity').val());
                            fd.append('rarity', rarity);
                            fd.append('description', $('#description').val());
                            fd.append('company_id', $('#company').val());
                            callback(fd);
                        } 
                    }
                });
            },
            init() {
                $(`${this.resource} .modal-body`).html(`
                    <ul class="js-errors"></ul>
                    <div class="form-group">
                        <label for="name">Name:</label>
                        <input type="text" class="form-control data-name" id="name">
                    </div>
                    <div class="form-group">
                        <label>Content:</label>
                        <input type="file" class="form-control data-image" id="file_meta" accept="video/mp4,image/*">
                    </div>
                    <div class="form-group">
                        <label>Thumbnail:</label>
                        <input type="file" class="form-control data-thumbnail" id="thumbnail" accept="image/*">
                    </div>                      
                    <div class="form-group">
                        <label for="description">Description:</label>
                        <input type="text" class="form-control data-description" id="description">
                    </div>
                    <div class="form-group">
                        <label for="company">Company:</label>
                        <select name="" class="form-control data-company" id="company"> </select>
                    </div>
                    <div class="form-group">
                        <label for="quantity">Quantity:</label>
                        <input type="number" class="form-control data-quantity" id="quantity" min="0">
                    </div>
                `);
            }
        },
        UpdateProduct: {
            resource: '#user-update',
            show(){
                $(`${this.resource}`).modal(true);
            },
            hide() {
                $(`${this.resource}`).modal('hide');
            },
            setDefaul(){

            },
            setVal(data){
                $(`${this.resource}`).find('.modal-title').html(`<i class="anticon anticon-info-circle m-r-5"></i> Air Drop detail`);
                $(`${this.resource}`).find('.data-description').val(data.description);
                $(`${this.resource}`).find('.data-metadata').val(data.metadata.name ?? '-');
                $(`${this.resource}`).find('.data-quantity').val(data.quantity);
                $(`${this.resource}`).find('.data-company').val(data.company_id.name);
                $(`${this.resource}`).find('.data-rarity').val(data.rarity);
                $(`${this.resource}`).find('.data-start-date').val(data.start_date == null ? '-' : moment.tz(data.start_date, 'Asia/Seoul').format('D/M/YYYY, k:mm:ss'));
                $(`${this.resource}`).find('.data-end-date').val(data.end_date == null ? '-' : moment.tz(data.end_date, 'Asia/Seoul').format('D/M/YYYY, k:mm:ss'));
            },
            getVal(){
                return {
                    'address' : $(`${this.resource}`).find('.data-address').val()
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
                $(`${this.resource} .modal-body`).html(`
                <div class="form-group">
                <label for="metadata">Name:</label>
                <input type="text" class="form-control data-metadata" id="metadata" disabled>
            </div>

            <div class="form-group">
                <label for="description">Description:</label>
                <input type="text" class="form-control data-description" id="description" disabled>
            </div>
            
            <div class="form-group">
                <label for="quantity">Quantity:</label>
                <input type="text" class="form-control data-quantity" id="quantity" disabled>
            </div>

            <div class="form-group">
                <label for="company">Company:</label>
                <input type="text" class="form-control data-company" id="company" disabled>
            </div>

            <div class="form-group">
            <label for="rarity">Rarity:</label>
            <input type="text" class="form-control data-rarity" id="rarity" disabled>
            </div>            

            <div class="form-group">
                <label for="start_date">Sale Start Date:</label>
                <input type="text" class="form-control data-start-date" id="start-date" disabled>
            </div>

            <div class="form-group">
                <label for="end_date">Sale End Date:</label>
                <input type="text" class="form-control data-end-date" id="end-date" disabled>
            </div>
                `);
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
                $(`${this.resource}`).find('.modal-title').html(`Update status airdrop`);
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
                $(`${this.resource}`).find('.modal-title').html(`Delete airdrop`);
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
                $(`${this.resource}`).find('.modal-title').html(`Delete ${data} airdrops`);
            },
            getVal(){
                var id_array = [];
                View.table.listSelectedRows().map(v => id_array.push(v._id))
                return {
                    'nft_ids' : id_array,
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
        UpdateTimeProduct: {
            resource: '#user-update_time',
            show(){
                $(`${this.resource}`).modal(true);
            },
            hide() {
                $(`${this.resource}`).modal('hide');
            },
            setDefaul(){ },
            setVal(data){
                $(`${this.resource}`).find('.modal-title').html(`Update time ${data} Airdrops`);
            },
            getVal(){
                var id_array = [];
                View.table.listSelectedRows().map(v => id_array.push(v._id))
                return {
                    'ids' : id_array,
                    'start_date' : View.modals.UpdateTimeProduct.UTCTime($('.time-start').val()),
                    'end_date' : View.modals.UpdateTimeProduct.UTCTime($('.time-end').val()),
                }
            },
            UTCTime(time){
                var date = new Date(time); 
                var now_utc =  Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(),
                 date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds());
                 return new Date(now_utc);
            },
            unbindAll() {
                $(document).off('click', `${this.resource} .modal-action`);
            },
            onPush(name, callback) {
                $(document).on('click', `${this.resource} .modal-action`, function() {
                    if($(this).attr('atr').trim() == name) {
                        if ($('.time-end').val() != '') {
                            if ($('.time-start').val() != '') {
                                callback();
                            }
                        }else{
                            callback();
                        }
                    }
                });
            },
            init() {
                var resource = this.resource;
                $(`${this.resource} .modal-body`).html(`
                    
                    <div class="row" style="margin: 0 -5px">
                        <div class="form-group col-md-6" style="padding: 0 5px;">
                            <label>Time Start</label>
                            <input type="text" class="form-control form_datetime time-start" placeholder="Time Start">
                        </div>
                        <div class="form-group col-md-6" style="padding: 0 5px;">
                            <label>Time End</label>
                            <input type="text" class="form-control form_datetime time-end" placeholder="Time End">
                        </div>
                    </div>
                `);
                var date = new Date();
                date.setDate(date.getDate());
                $('.form_datetime').datetimepicker({
                    startDate: date,
                    format: 'yyyy/mm/dd hh:ii',
                    weekStart: 1,
                    todayBtn:  1,
                    autoclose: 1,
                    todayHighlight: 1,
                    startView: 2,
                    forceParse: 0,
                    showMeridian: 1
                });

                $('.time-end').on('change', function(){
                    $(`${resource} .modal-body`).find('.time-warning').remove()
                    if ($('.time-start').val() == '') {
                        $(`${resource} .modal-body`).prepend(`
                            <div class="alert alert-danger time-warning">Time start is not null</div>
                        `)
                    }
                    if ($('.time-start').val() >= $('.time-end').val()) {

                        $(`${resource} .modal-body`).prepend(`
                            <div class="alert alert-danger time-warning">Time start must be less than time end</div>
                        `)
                    }
                })
                $('.time-start').on('change', function(){
                    $(`${resource} .modal-body`).find('.time-warning').remove()
                    if ($('.time-start').val() == '') {
                        $(`${resource} .modal-body`).prepend(`
                            <div class="alert alert-danger time-warning">Time start is not null</div>
                        `)
                    } else if ($('.time-start').val() >= $('.time-end').val()) {
                        $(`${resource} .modal-body`).prepend(`
                            <div class="alert alert-danger time-warning">Time start must be less than time end</div>
                        `)
                    }
                    
                })
                
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


    View.selectedAction.onAtrAction("Set Schedule", (item) => {
        View.modals.UpdateTimeProduct.init();
        View.modals.UpdateTimeProduct.setVal(Object.entries(View.table.__selected).length);
        View.modals.UpdateTimeProduct.show();
        View.modals.UpdateTimeProduct.unbindAll();
        View.modals.UpdateTimeProduct.onPush("Save", () => {
            View.helper.showToastProcessing('Processing', 'Updating  !');
            View.modals.UpdateTimeProduct.hide();
            Api.Product.UpdateTime(View.modals.UpdateTimeProduct.getVal())
                    .done(res => {
                        View.helper.showToastSuccess('Success', 'Update successful'); 
                        View.table.__selected = {}
                        LoadData(0);
                    })
                    .fail(err => {
                        View.helper.showToastError('Error', 'Something Wrong'); 
                    })
                    .always(() => {
                    });
        });
    })


    View.selectedAction.onAtrAction("Delete", (item) => {
        View.modals.DeleteUser.setVal(Object.entries(View.table.__selected).length);
        View.modals.DeleteUser.show();
        View.modals.DeleteUser.unbindAll();
        View.modals.DeleteUser.onPush("Save", () => {
            View.helper.showToastProcessing('Processing', 'Deleting serials !');
            View.modals.DeleteUser.hide();

            Api.Product.DeleteMany(View.modals.DeleteUser.getVal())
                .done(res => {
                    View.helper.showToastSuccess('Success', 'Delete successful'); 
                    View.table.__selected = {}
                    LoadData(0);
                })
                .fail(err => {
                    View.helper.showToastError('Error', 'Something Wrong'); 
                })
                .always(() => {
                });

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

    View.table.onCreate("Create", () => {
        View.modals.CreateProduct.init();
        View.modals.CreateProduct.show();
        var filter = {
            'status'        : status
        }
        Api.Company.GetAll(View.table.pagination.page, View.table.pagination.pageSize, filter)
            .done(res => {
                View.modals.CreateProduct.setVal(res);
                View.modals.CreateProduct.unbindAll();
                View.modals.CreateProduct.onPush("Save", (fd) => {
                    View.helper.showToastProcessing('Processing', 'Create Airdrop !');
                    console.log(fd);
                    Api.Product.Create(fd)
                        .done(res => {
                            View.helper.showToastSuccess('Success', 'Create successful'); 
                            View.modals.CreateProduct.hide();
                            LoadData();
                        })
                        .fail(err => {
                            View.helper.showToastError('Error', 'Something Wrong'); 
                        })
                        .always(() => {
                        });
            });
       
        });

    })
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
            Api.Product.UpdateStatus(id, data)
                .done(res => {
                    View.helper.showToastSuccess('Success', 'Update successful'); 
                    View.table.updateColumn(id, status, 7)
                })
                .fail(err => {
                    View.helper.showToastError('Error', 'Something Wrong'); 
                })
                .always(() => {
                });
        });
    })
    View.table.onRowAction("View", (id) => {
        Api.Product.GetOne(id)
            .done(res => {
                console.log(res);
                View.modals.UpdateProduct.init();
                View.modals.UpdateProduct.show();
                View.modals.UpdateProduct.setVal(res.data);
                View.modals.UpdateProduct.unbindAll();
                View.modals.UpdateProduct.onPush("Save", () => {
                    View.helper.showToastProcessing('Processing', 'Update status !');
                    console.log(View.modals.UpdateProduct.getVal());
                    Api.Product.UpdateStatus(id, View.modals.UpdateProduct.getVal())
                        .done(res => {
                            View.helper.showToastSuccess('Success', 'Update successful'); 
                            View.table.updateColumn(id, status, 2)
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
    View.table.onRowAction("Delete", (id) => {
        View.modals.DeleteOneUser.show();
        View.modals.DeleteOneUser.setVal();
        View.modals.DeleteOneUser.unbindAll();
        View.modals.DeleteOneUser.onPush("Save", () => {
            View.helper.showToastProcessing('Processing', 'Delete airdrop !');
            Api.Product.Delete(id)
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
    
    View.onSwitch((item) => {
        item.find('.slider').toggleClass('active');
        var data_id = item.attr('data-id')
        var data_status = item.attr('data-status')
        console.log(data_id);
        Api.Product.UpdateSelling(data_id, data_status)
            .done(res => {
                console.log(res);
            })
            .fail(err => {
                View.helper.showToastError('Error', 'Something Wrong'); 
            })
            .always(() => {
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
        console.log(filter);

        if (keyword != '' || status != '') View.filter.reset.isOn();
        else View.filter.reset.isOff();

        Api.Product.GetAll(View.table.pagination.page, View.table.pagination.pageSize, 1, filter)
            .done(res => {
                console.log(res);
                loadOrders(res); 
            });
    }
    LoadData();


})();

