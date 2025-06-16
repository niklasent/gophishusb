// labels is a map of campaign statuses to
// CSS classes
var labels = {
    "In progress": "label-primary",
    "Completed": "label-success"
}

var campaigns = []
var campaign = {}

// Launch attempts to POST to /campaigns/
function launch() {
    Swal.fire({
        title: "Are you sure?",
        text: "This will schedule the campaign to be launched.",
        type: "question",
        animation: false,
        showCancelButton: true,
        confirmButtonText: "Launch",
        confirmButtonColor: "#428bca",
        reverseButtons: true,
        allowOutsideClick: false,
        showLoaderOnConfirm: true,
        preConfirm: function () {
            return new Promise(function (resolve, reject) {
                groups = []
                $("#targets").select2("data").forEach(function (group) {
                    groups.push({
                        name: group.text
                    });
                })
                // Validate our fields
                campaign = {
                    name: $("#name").val(),
                    groups: groups
                }
                // Submit the campaign
                api.campaigns.post(campaign)
                    .success(function (data) {
                        resolve()
                        campaign = data
                    })
                    .error(function (data) {
                        $("#modal\\.flashes").empty().append("<div style=\"text-align:center\" class=\"alert alert-danger\">\
            <i class=\"fa fa-exclamation-circle\"></i> " + data.responseJSON.message + "</div>")
                        Swal.close()
                    })
            })
        }
    }).then(function (result) {
        if (result.value){
            Swal.fire(
                'Campaign Launched!',
                'This campaign has been launched!',
                'success'
            );
        }
        $('button:contains("OK")').on('click', function () {
            window.location = "/campaigns/" + campaign.id.toString()
        })
    })
}

function dismiss() {
    $("#modal\\.flashes").empty();
    $("#name").val("");
    $("#targets").val("").change();
}

function deleteCampaign(idx) {
    Swal.fire({
        title: "Are you sure?",
        text: "This will delete the campaign. This can't be undone!",
        type: "warning",
        animation: false,
        showCancelButton: true,
        confirmButtonText: "Delete " + campaigns[idx].name,
        confirmButtonColor: "#428bca",
        reverseButtons: true,
        allowOutsideClick: false,
        preConfirm: function () {
            return new Promise(function (resolve, reject) {
                api.campaignId.delete(campaigns[idx].id)
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
                'Campaign Deleted!',
                'This campaign has been deleted!',
                'success'
            );
        }
        $('button:contains("OK")').on('click', function () {
            location.reload()
        })
    })
}

function setupOptions() {
    api.groups.summary()
        .success(function (summaries) {
            groups = summaries.groups
            valid_groups = []
            groups.forEach((group) => {
                if (group.length !== 0) valid_groups.push(group)
            })
            if (valid_groups.length == 0) {
                modalError("No valid groups found!")
                return false;
            } else {
                var group_s2 = $.map(valid_groups, function (obj) {
                    obj.text = obj.name
                    obj.title = obj.num_targets + " targets"
                    return obj
                });
                console.log(group_s2)
                $("#targets.form-control").select2({
                    placeholder: "Select Groups",
                    data: group_s2,
                });
            }
        });
}

function edit(campaign) {
    setupOptions();
}

function copy(idx) {
    setupOptions();
    // Set our initial values
    api.campaignId.get(campaigns[idx].id)
        .success(function (campaign) {
            $("#name").val("Copy of " + campaign.name)
        })
        .error(function (data) {
            $("#modal\\.flashes").empty().append("<div style=\"text-align:center\" class=\"alert alert-danger\">\
            <i class=\"fa fa-exclamation-circle\"></i> " + data.responseJSON.message + "</div>")
        })
}

$(document).ready(function () {
    $("#created_date").datetimepicker({
        "widgetPositioning": {
            "vertical": "bottom"
        },
        "showTodayButton": true,
        "defaultDate": moment(),
        "format": "MMMM Do YYYY, h:mm a"
    })
    // Setup multiple modals
    // Code based on http://miles-by-motorcycle.com/static/bootstrap-modal/index.html
    $('.modal').on('hidden.bs.modal', function (event) {
        $(this).removeClass('fv-modal-stack');
        $('body').data('fv_open_modals', $('body').data('fv_open_modals') - 1);
    });
    $('.modal').on('shown.bs.modal', function (event) {
        // Keep track of the number of open modals
        if (typeof ($('body').data('fv_open_modals')) == 'undefined') {
            $('body').data('fv_open_modals', 0);
        }
        // if the z-index of this modal has been set, ignore.
        if ($(this).hasClass('fv-modal-stack')) {
            return;
        }
        $(this).addClass('fv-modal-stack');
        // Increment the number of open modals
        $('body').data('fv_open_modals', $('body').data('fv_open_modals') + 1);
        // Setup the appropriate z-index
        $(this).css('z-index', 1040 + (10 * $('body').data('fv_open_modals')));
        $('.modal-backdrop').not('.fv-modal-stack').css('z-index', 1039 + (10 * $('body').data('fv_open_modals')));
        $('.modal-backdrop').not('fv-modal-stack').addClass('fv-modal-stack');
    });
    // Scrollbar fix - https://stackoverflow.com/questions/19305821/multiple-modals-overlay
    $(document).on('hidden.bs.modal', '.modal', function () {
        $('.modal:visible').length && $(document.body).addClass('modal-open');
    });
    $('#modal').on('hidden.bs.modal', function (event) {
        dismiss()
    });
    api.campaigns.summary()
        .success(function (data) {
            campaigns = data.campaigns
            $("#loading").hide()
            if (campaigns.length > 0) {
                $("#campaignTable").show()
                $("#campaignTableArchive").show()

                activeCampaignsTable = $("#campaignTable").DataTable({
                    columnDefs: [{
                        orderable: false,
                        targets: "no-sort"
                    }],
                    order: [
                        [1, "desc"]
                    ]
                });
                archivedCampaignsTable = $("#campaignTableArchive").DataTable({
                    columnDefs: [{
                        orderable: false,
                        targets: "no-sort"
                    }],
                    order: [
                        [1, "desc"]
                    ]
                });
                rows = {
                    'active': [],
                    'archived': []
                }
                $.each(campaigns, function (i, campaign) {
                    label = labels[campaign.status] || "label-default";

                    //section for tooltips on the status of a campaign to show some quick stats
                    var launchDate;
                    launchDate = "Launch Date: " + moment(campaign.created_date).format('MMMM Do YYYY, h:mm:ss a')
                    var quickStats = launchDate + "<br><br>" + "Number of targets: " + campaign.stats.total + "<br><br>" + "USBs mounted: " + campaign.stats.mounted + "<br><br>" + "Macros opened: " + campaign.stats.macros_opened + "<br><br>" + "Executables opened: " + campaign.stats.executables_opened

                    var row = [
                        escapeHtml(campaign.name),
                        moment(campaign.created_date).format('MMMM Do YYYY, h:mm:ss a'),
                        "<span class=\"label " + label + "\" data-toggle=\"tooltip\" data-placement=\"right\" data-html=\"true\" title=\"" + quickStats + "\">" + campaign.status + "</span>",
                        "<div class='pull-right'><a class='btn btn-primary' href='/campaigns/" + campaign.id + "' data-toggle='tooltip' data-placement='left' title='View Results'>\
                    <i class='fa fa-bar-chart'></i>\
                    </a>\
            <span data-toggle='modal' data-backdrop='static' data-target='#modal'><button class='btn btn-primary' data-toggle='tooltip' data-placement='left' title='Copy Campaign' onclick='copy(" + i + ")'>\
                    <i class='fa fa-copy'></i>\
                    </button></span>\
                    <button class='btn btn-danger' onclick='deleteCampaign(" + i + ")' data-toggle='tooltip' data-placement='left' title='Delete Campaign'>\
                    <i class='fa fa-trash-o'></i>\
                    </button></div>"
                    ]
                    if (campaign.status == 'Completed') {
                        rows['archived'].push(row)
                    } else {
                        rows['active'].push(row)
                    }
                })
                activeCampaignsTable.rows.add(rows['active']).draw()
                archivedCampaignsTable.rows.add(rows['archived']).draw()
                $('[data-toggle="tooltip"]').tooltip()
            } else {
                $("#emptyMessage").show()
            }
        })
        .error(function () {
            $("#loading").hide()
            errorFlash("Error fetching campaigns")
        })
    // Select2 Defaults
    $.fn.select2.defaults.set("width", "100%");
    $.fn.select2.defaults.set("dropdownParent", $("#modal_body"));
    $.fn.select2.defaults.set("theme", "bootstrap");
    $.fn.select2.defaults.set("sorter", function (data) {
        return data.sort(function (a, b) {
            if (a.text.toLowerCase() > b.text.toLowerCase()) {
                return 1;
            }
            if (a.text.toLowerCase() < b.text.toLowerCase()) {
                return -1;
            }
            return 0;
        });
    })
})
