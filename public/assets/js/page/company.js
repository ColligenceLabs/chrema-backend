const View = {
    filter: {
        searchBy: 'address',
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
        __generateDTRow(data) {
            const checked = this.__selected[data._id] ? 'checked' : '';
            var status_push = data.status == "active" ? "inactive" : "active";
            return [
                data._id,
                `<input type="checkbox" class="form-control" style="min-height:20px;box-shadow:none;" ${checked}>`,
                data.name,
                `<div class="d-flex align-items-center relative" data-id="${data._id}">
                    <div class="badge badge-${this.__barge[data.status]} badge-dot m-r-10"></div>
                    <div class="status_name" data-status-change="${status_push}">${this.__bargeText[data.status]}</div>
                </div>`,
                new Date(data.createdAt).toLocaleString(),
                `<div class="d-flex align-items-center" data-id="${data._id}">
                    <div class="row-action bg-hover m-r-10" atr="Update Status"><i class="anticon anticon-sync"></i></div>
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
        insertRow(data) {
            const dtRow = this.__generateDTRow(data);
            this.__table.row.add(dtRow);
            this.__rows.push(data);
        },
        updateRow(id, data) {
            if(data) {
                this.__rows[id] = data;
            }
            const dtRow = this.__generateDTRow(this.__rows[id]);
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
            if (index == 3) {
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
                        title: 'Name',
                        name: 'name',
                        orderable: false,
                    },
                    {
                        title: 'Status',
                        name: 'status',
                        orderable: false,
                        width: '30%',
                    },
                    {
                        title: 'Created at',
                        name: 'created_at',
                        orderable: false,
                        width: '30%',
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
    modals: {
        CreateUser: {
            resource: '#user-create',
            show(){
                $(`${this.resource}`).modal(true);
            },
            hide() {
                $(`${this.resource}`).modal('hide');
            },
            setDefaul(){

            },
            setVal(){
                $(`${this.resource}`).find('.modal-title').html(`User create`);
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
                        <label for="address">Address:</label>
                        <input type="text" class="form-control data-address" id="address">
                    </div>
                `);
            }
        },
        UpdateUser: {
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
                $(`${this.resource}`).find('.modal-title').html(`<i class="anticon anticon-info-circle m-r-5"></i> User detail`);
                $(`${this.resource}`).find('.data-address').val(data.address);
                $(`${this.resource}`).find('.data-id').val(data.id);
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
                        <label for="id">User id:</label>
                        <input type="text" class="form-control data-id" id="id" disabled>
                    </div>
                    <div class="form-group">
                        <label for="address">Address:</label>
                        <input type="text" class="form-control data-address" id="address" disabled>
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
                $(`${this.resource}`).find('.modal-title').html(`Update status user`);
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
                $(`${this.resource}`).find('.modal-title').html(`Delete user`);
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
        res.data.items.map(v => {
            View.table.insertRow(v);
        })
        View.table.render();
    };

    View.selectedAction.onSelect((item) => {
        View.selectedAction.setSearch(item.text());
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
    View.table.onMultiDelete("Delete Multi", () => {
        View.modals.DeleteUser.setVal(Object.entries(View.table.__selected).length);
        View.modals.DeleteUser.show();
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

    // View.table.onCreate("Create", () => {
    //     View.modals.CreateUser.init();
    //     View.modals.CreateUser.show();
    //     View.modals.CreateUser.setVal();
    //     View.modals.CreateUser.unbindAll();
    //     View.modals.CreateUser.onPush("Save", () => {
    //         View.helper.showToastProcessing('Processing', 'Create user !');
    //         Api.User.Create(View.modals.CreateUser.getVal())
    //             .done(res => {
    //                 View.helper.showToastSuccess('Success', 'Create successful'); 
    //                 View.modals.CreateUser.hide();
    //                 LoadData();
    //             })
    //             .fail(err => {
    //                 View.helper.showToastError('Error', 'Something Wrong'); 
    //             })
    //             .always(() => {
    //             });
    //     });

    // })
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
            Api.Company.UpdateStatus(id, data)
                .done(res => {
                    View.helper.showToastSuccess('Success', 'Update successful'); 
                    View.table.updateColumn(id, status, 3)
                })
                .fail(err => {
                    View.helper.showToastError('Error', 'Something Wrong'); 
                })
                .always(() => {
                });
        });
    })
    View.table.onRowAction("View", (id) => {
        Api.Company.GetOne(id)
            .done(res => {
                View.modals.UpdateUser.init();
                View.modals.UpdateUser.show();
                data = {
                    'address' : res.data.address,
                    'id' : res.data._id,
                }
                View.modals.UpdateUser.setVal(data);
                View.modals.UpdateUser.unbindAll();
                View.modals.UpdateUser.onPush("Save", () => {
                    View.helper.showToastProcessing('Processing', 'Update status !');
                    Api.Company.UpdateStatus(id, View.modals.UpdateUser.getVal())
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
            View.helper.showToastProcessing('Processing', 'Delete user !');
            Api.Company.Delete(id)
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

        var filter = {
            'status'        : status
        }
        filter[`${searchBy}`] = keyword;

        if (keyword != '' || status != '') View.filter.reset.isOn();
        else View.filter.reset.isOff();

        Api.Company.GetAll(View.table.pagination.page, View.table.pagination.pageSize, filter)
            .done(res => {
                console.log(res);
                loadOrders(res);
            });
    }
    LoadData();


})();

