var groups = []

// Save attempts to POST or PUT to /groups/
function save(id) {
    var group = {
        name: $("#name").val()
    }
    // Submit the group
    if (id != -1) {
        // If we're just editing an existing group,
        // we need to PUT /groups/:id
        group.id = id
        api.groupId.put(group)
            .success(function (data) {
                successFlash("Group updated successfully!")
                load()
                dismiss()
                $("#modal").modal('hide')
            })
            .error(function (data) {
                modalError(data.responseJSON.message)
            })
    } else {
        // Else, if this is a new group, POST it
        // to /groups
        api.groups.post(group)
            .success(function (data) {
                successFlash("Group added successfully!")
                load()
                dismiss()
                $("#modal").modal('hide')
            })
            .error(function (data) {
                modalError(data.responseJSON.message)
            })
    }
}

function dismiss() {
    $("#name").val("")
    $("#modal\\.flashes").empty()
}

function edit(id) {
    $("#modalSubmit").unbind('click').click(function () {
        save(id)
    })
    if (id == -1) {
        $("#groupModalLabel").text("New Group");
        var group = {}
    } else {
        $("#groupModalLabel").text("Edit Group");
        api.groupId.get(id)
            .success(function (group) {
                $("#name").val(group.name)
            })
            .error(function () {
                errorFlash("Error fetching group")
            })
    }
}

var deleteGroup = function (id) {
    var group = groups.find(function (x) {
        return x.id === id
    })
    if (!group) {
        return
    }
    Swal.fire({
        title: "Are you sure?",
        text: "This will delete the group. This can't be undone!",
        type: "warning",
        animation: false,
        showCancelButton: true,
        confirmButtonText: "Delete " + escapeHtml(group.name),
        confirmButtonColor: "#428bca",
        reverseButtons: true,
        allowOutsideClick: false,
        preConfirm: function () {
            return new Promise(function (resolve, reject) {
                api.groupId.delete(id)
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
                'Group Deleted!',
                'This group has been deleted!',
                'success'
            );
        }
        $('button:contains("OK")').on('click', function () {
            location.reload()
        })
    })
}

function load() {
    $("#groupTable").hide()
    $("#emptyMessage").hide()
    $("#loading").show()
    api.groups.summary()
        .success(function (response) {
            $("#loading").hide()
            if (response.total > 0) {
                groups = response.groups
                $("#emptyMessage").hide()
                $("#groupTable").show()
                var groupTable = $("#groupTable").DataTable({
                    destroy: true,
                    columnDefs: [{
                        orderable: false,
                        targets: "no-sort"
                    }]
                });
                groupTable.clear();
                groupRows = []
                $.each(groups, function (i, group) {
                    groupRows.push([
                        escapeHtml(group.name),
                        escapeHtml(group.num_targets),
                        moment(group.modified_date).format('MMMM Do YYYY, h:mm:ss a'),
                        "<div class='pull-right'><button class='btn btn-primary' data-toggle='modal' data-backdrop='static' data-target='#modal' onclick='edit(" + group.id + ")'>\
                    <i class='fa fa-pencil'></i>\
                    </button>\
                    <button class='btn btn-danger' onclick='deleteGroup(" + group.id + ")'>\
                    <i class='fa fa-trash-o'></i>\
                    </button></div>"
                    ])
                })
                groupTable.rows.add(groupRows).draw()
            } else {
                $("#emptyMessage").show()
            }
        })
        .error(function () {
            errorFlash("Error fetching groups")
        })
}

$(document).ready(function () {
    load()
    $("#modal").on("hide.bs.modal", function () {
        dismiss();
    });
});
