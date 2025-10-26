var group = {}
var targets = []

var deleteTarget = function (id) {
    var target = targets.find(function (x) {
        return x.id === id
    })
    if (!target) {
        return
    }
    Swal.fire({
        title: "Are you sure?",
        text: "This will delete the target. This can't be undone!",
        type: "warning",
        animation: false,
        showCancelButton: true,
        confirmButtonText: "Delete " + escapeHtml(target.hostname),
        confirmButtonColor: "#428bca",
        reverseButtons: true,
        allowOutsideClick: false,
        preConfirm: function () {
            return new Promise(function (resolve, reject) {
                api.targetId.delete(id)
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
                'Target Deleted!',
                'This target has been deleted!',
                'success'
            );
        }
        $('button:contains("OK")').on('click', function () {
            location.reload()
        })
    })
}

function load() {
    group.id = window.location.pathname.split('/').slice(-1)[0]
    $("#targetTable").hide()
    $("#emptyMessage").hide()
    $("#loading").show()
    api.groupId.get(group.id)
        .success(function (g) {
            group = g
            $("title").text(group.name + " - Targets")
            // Set the title
            $("#page-title").text("Targets of " + group.name)
            $("#loading").hide()
            targets = group.targets
            if (targets.length > 0) {
                $("#emptyMessage").hide()
                $("#targetTable").show()
                var targetTable = $("#targetTable").DataTable({
                    destroy: true,
                    columnDefs: [{
                        orderable: false,
                        targets: "no-sort"
                    }]
                });
                targetTable.clear();
                targetRows = []
                $.each(targets, function (i, target) {
                    targetRows.push([
                        escapeHtml(target.hostname),
                        escapeHtml(target.os),
                        moment(target.registered_date).format('MMMM Do YYYY, h:mm:ss a'),
                        moment(target.last_seen).format('MMMM Do YYYY, h:mm:ss a'),
                        "<div class='pull-right'>\
                        </button>\
                        <button class='btn btn-danger' onclick='deleteTarget(" + target.id + ")'>\
                        <i class='fa fa-trash-o'></i>\
                        </button></div>"
                    ])
                })
                targetTable.rows.add(targetRows).draw()
            } else {
                $("#emptyMessage").show()
            }
        })
        .error(function () {
            $("#loading").hide()
            errorFlash("Group not found!")
        })
}

$(document).ready(function () {
    load()
});