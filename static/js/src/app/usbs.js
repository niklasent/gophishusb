var usbs = []

var deleteUsb = function (id) {
    var usb = usbs.find(function (x) {
        return x.id === id
    })
    if (!usb) {
        return
    }
    Swal.fire({
        title: "Are you sure?",
        text: "This will delete the USB device. This can't be undone!",
        type: "warning",
        animation: false,
        showCancelButton: true,
        confirmButtonText: "Delete " + escapeHtml(usb.name),
        confirmButtonColor: "#428bca",
        reverseButtons: true,
        allowOutsideClick: false,
        preConfirm: function () {
            return new Promise(function (resolve, reject) {
                api.usbId.delete(id)
                    .success(function (msg) {
                        resolve()
                    })
                    .error(function (data) {
                        reject(data.responseJSON.message)
                    })
            })
        }
    }).then(function (result) {
        if (result.value){
            Swal.fire(
                'USB Deleted!',
                'This USB device has been deleted!',
                'success'
            );
        }
        $('button:contains("OK")').on('click', function () {
            location.reload()
        })
    })
}

function load() {
    $("#usbTable").hide()
    $("#emptyMessage").hide()
    $("#loading").show()
    api.usbs.get()
        .success(function (response) {
            $("#loading").hide()
            if (response.length > 0) {
                usbs = response
                $("#emptyMessage").hide()
                $("#usbTable").show()
                var usbTable = $("#usbTable").DataTable({
                    destroy: true,
                    columnDefs: [{
                        orderable: false,
                        targets: "no-sort"
                    }]
                });
                usbTable.clear();
                usbRows = []
                $.each(usbs, function (i, usb) {
                    usbRows.push([
                        escapeHtml(usb.name),
                        moment(usb.registered_date).format('MMMM Do YYYY, h:mm:ss a'),
                        "<div class='pull-right'>\
                        </button>\
                        <button class='btn btn-danger' onclick='deleteUsb(" + usb.id + ")'>\
                        <i class='fa fa-trash-o'></i>\
                        </button></div>"
                    ])
                })
                usbTable.rows.add(usbRows).draw()
            } else {
                $("#emptyMessage").show()
            }
        })
        .error(function () {
            errorFlash("Error fetching USB devices")
        })
}

$(document).ready(function () {
    load()
});