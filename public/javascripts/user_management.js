$(document).ready(function () {
    document.getElementById('user_current').className = 'active nav-link';

    $.ajax({
        type: 'GET',
        url: '/api/user/indexs',
        success: (data) => {
            let html = ``;
            if (data && data.status === 1) {
                data.data.items.map((item, index) => {
                    html += `<tr>
                    <td scope="row">
                    <div class="form-check">
                      <input class="form-check-input" type="checkbox" value=${item._id}>
                    </div>
                    </td>
                    <td>${index + 1}</td>
                    <td>${item.address || '-'}</td>
                    <td>${item.status || '-'}</td>
                    <td>xxx</td>
                  </tr>`;
                });
                html += ``;
                document.getElementById('table_list').innerHTML = html;
                return;
            }
            html = `<img src="../../images/notfound.jpg" alt="Girl in a jacket" width="250px" height="300px">`;
            document.getElementById('loader').innerHTML = html;
            return;
        },
    });
});
