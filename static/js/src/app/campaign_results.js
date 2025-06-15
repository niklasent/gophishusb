var map = null
var doPoll = true;

// statuses is a helper map to point result statuses to ui classes
var statuses = {
    "Active": {
        color: "#1abc9c",
        label: "label-success",
        icon: "fa-laptop",
        point: "ct-point-active"
    },
    "In progress": {
        label: "label-primary"
    },
    "Completed": {
        label: "label-success"
    },
    "USB Mounted": {
        color: "#f9bf3b",
        label: "label-warning",
        icon: "fa-usb",
        point: "ct-point-mount"
    },
    "Opened Macro": {
        color: "#F39C12",
        label: "label-macro",
        icon: "fa-file",
        point: "ct-point-macro"
    },
    "Opened Executable": {
        color: "#f05b4f",
        label: "label-danger",
        icon: "fa-gear",
        point: "ct-point-exec"
    },
    "Opened Everything": {
        color: "#f05b4f",
        label: "label-danger",
        icon: "fa-gear",
        point: "ct-point-exec"
    },
    "Unknown": {
        color: "#6c7a89",
        label: "label-default",
        icon: "fa-question",
        point: "ct-point-error"
    },
    "Campaign Created": {
        label: "label-success",
        icon: "fa-rocket"
    }
}

var statusMapping = {
    "Active": "active",
    "USB Mounted": "mount",
    "Opened Macro": "macro",
    "Opened Executable": "exec",
    "Opened Everything": "every"
}

// This is an underwhelming attempt at an enum
// until I have time to refactor this appropriately.
var progressListing = [
    "Active",
    "USB Mounted",
    "Opened Macro",
    "Opened Executable",
    "Opened Everything"
]

var campaign = {}
var bubbles = []

function dismiss() {
    $("#modal\\.flashes").empty()
    $("#modal").modal('hide')
    $("#resultsTable").dataTable().DataTable().clear().draw()
}

// Deletes a campaign after prompting the user
function deleteCampaign() {
    Swal.fire({
        title: "Are you sure?",
        text: "This will delete the campaign. This can't be undone!",
        type: "warning",
        animation: false,
        showCancelButton: true,
        confirmButtonText: "Delete Campaign",
        confirmButtonColor: "#428bca",
        reverseButtons: true,
        allowOutsideClick: false,
        showLoaderOnConfirm: true,
        preConfirm: function () {
            return new Promise(function (resolve, reject) {
                api.campaignId.delete(campaign.id)
                    .success(function (msg) {
                        resolve()
                    })
                    .error(function (data) {
                        reject(data.responseJSON.message)
                    })
            })
        }
    }).then(function (result) {
        if(result.value){
            Swal.fire(
                'Campaign Deleted!',
                'This campaign has been deleted!',
                'success'
            );
        }
        $('button:contains("OK")').on('click', function () {
            location.href = '/campaigns'
        })
    })
}

// Completes a campaign after prompting the user
function completeCampaign() {
    Swal.fire({
        title: "Are you sure?",
        text: "GophishUSB will stop processing events for this campaign",
        type: "warning",
        animation: false,
        showCancelButton: true,
        confirmButtonText: "Complete Campaign",
        confirmButtonColor: "#428bca",
        reverseButtons: true,
        allowOutsideClick: false,
        showLoaderOnConfirm: true,
        preConfirm: function () {
            return new Promise(function (resolve, reject) {
                api.campaignId.complete(campaign.id)
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
                'Campaign Completed!',
                'This campaign has been completed!',
                'success'
            );
            $('#complete_button')[0].disabled = true;
            $('#complete_button').text('Completed!')
            doPoll = false;
        }
    })
}

// Exports campaign results as a CSV file
function exportAsCSV(scope) {
    exportHTML = $("#exportButton").html()
    var csvScope = null
    var filename = campaign.name + ' - ' + capitalize(scope) + '.csv'
    switch (scope) {
        case "results":
            csvScope = campaign.results
            break;
        case "events":
            csvScope = campaign.timeline
            break;
    }
    if (!csvScope) {
        return
    }
    $("#exportButton").html('<i class="fa fa-spinner fa-spin"></i>')
    var csvString = Papa.unparse(csvScope, {
        'escapeFormulae': true
    })
    var csvData = new Blob([csvString], {
        type: 'text/csv;charset=utf-8;'
    });
    if (navigator.msSaveBlob) {
        navigator.msSaveBlob(csvData, filename);
    } else {
        var csvURL = window.URL.createObjectURL(csvData);
        var dlLink = document.createElement('a');
        dlLink.href = csvURL;
        dlLink.setAttribute('download', filename)
        document.body.appendChild(dlLink)
        dlLink.click();
        document.body.removeChild(dlLink)
    }
    $("#exportButton").html(exportHTML)
}

function renderTimeline(data) {
    record = {
        "id": data[0],
        "hostname": data[2],
        "os": data[3],
        "username": data[4],
        "status": data[5],
    }
    results = '<div class="timeline col-sm-12 well well-lg">' +
        '<h6>Timeline for ' + escapeHtml(record.hostname) +
        '</h6><span class="subtitle">Result ID: ' + escapeHtml(record.id) + '</span>' +
        '<div class="timeline-graph col-sm-6">'
    $.each(campaign.timeline, function (i, event) {
        if (!event.hostname || event.hostname == record.hostname) {
            // Add the event
            results += '<div class="timeline-entry">' +
                '    <div class="timeline-bar"></div>'
            results +=
                '    <div class="timeline-icon ' + statuses[event.message].label + '">' +
                '    <i class="fa ' + statuses[event.message].icon + '"></i></div>' +
                '    <div class="timeline-message">' + escapeHtml(event.message) +
                '    <span class="timeline-date">' + moment.utc(event.time).local().format('MMMM Do YYYY h:mm:ss a') + '</span>' 
            if (event.details) {
                results += '    <span class="timeline-username">' + 'by ' + escapeHtml(JSON.parse(event.details).username) + '</span>'
            }
            results += '</div></div>'
        }
    })
    results += '</div></div>'
    return results
}

var renderTimelineChart = function (chartopts) {
    return Highcharts.chart('timeline_chart', {
        chart: {
            zoomType: 'x',
            type: 'line',
            height: "200px"
        },
        title: {
            text: 'Campaign Timeline'
        },
        xAxis: {
            type: 'datetime',
            dateTimeLabelFormats: {
                second: '%l:%M:%S',
                minute: '%l:%M',
                hour: '%l:%M',
                day: '%b %d, %Y',
                week: '%b %d, %Y',
                month: '%b %Y'
            }
        },
        yAxis: {
            min: 0,
            max: 2,
            visible: false,
            tickInterval: 1,
            labels: {
                enabled: false
            },
            title: {
                text: ""
            }
        },
        tooltip: {
            formatter: function () {
                return Highcharts.dateFormat('%A, %b %d %l:%M:%S %P', new Date(this.x)) +
                    '<br>Event: ' + this.point.message + '<br>Hostname: <b>' + this.point.hostname + '</b>'
            }
        },
        legend: {
            enabled: false
        },
        plotOptions: {
            series: {
                marker: {
                    enabled: true,
                    symbol: 'circle',
                    radius: 3
                },
                cursor: 'pointer',
            },
            line: {
                states: {
                    hover: {
                        lineWidth: 1
                    }
                }
            }
        },
        credits: {
            enabled: false
        },
        series: [{
            data: chartopts['data'],
            dashStyle: "shortdash",
            color: "#cccccc",
            lineWidth: 1,
            turboThreshold: 0
        }]
    })
}

/* Renders a pie chart using the provided chartops */
var renderPieChart = function (chartopts) {
    return Highcharts.chart(chartopts['elemId'], {
        chart: {
            type: 'pie',
            events: {
                load: function () {
                    var chart = this,
                        rend = chart.renderer,
                        pie = chart.series[0],
                        left = chart.plotLeft + pie.center[0],
                        top = chart.plotTop + pie.center[1];
                    this.innerText = rend.text(chartopts['data'][0].count, left, top).
                    attr({
                        'text-anchor': 'middle',
                        'font-size': '24px',
                        'font-weight': 'bold',
                        'fill': chartopts['colors'][0],
                        'font-family': 'Helvetica,Arial,sans-serif'
                    }).add();
                },
                render: function () {
                    this.innerText.attr({
                        text: chartopts['data'][0].count
                    })
                }
            }
        },
        title: {
            text: chartopts['title']
        },
        plotOptions: {
            pie: {
                innerSize: '80%',
                dataLabels: {
                    enabled: false
                }
            }
        },
        credits: {
            enabled: false
        },
        tooltip: {
            formatter: function () {
                if (this.key == undefined) {
                    return false
                }
                return '<span style="color:' + this.color + '">\u25CF</span>' + this.point.name + ': <b>' + this.y + '%</b><br/>'
            }
        },
        series: [{
            data: chartopts['data'],
            colors: chartopts['colors'],
        }]
    })
}

/* Updates the bubbles on the map

@param {campaign.result[]} results - The campaign results to process
*/
var updateMap = function (results) {
    if (!map) {
        return
    }
    bubbles = []
    $.each(campaign.results, function (i, result) {
        // Check that it wasn't an internal IP
        if (result.latitude == 0 && result.longitude == 0) {
            return true;
        }
        newIP = true
        $.each(bubbles, function (i, bubble) {
            if (bubble.ip == result.ip) {
                bubbles[i].radius += 1
                newIP = false
                return false
            }
        })
        if (newIP) {
            bubbles.push({
                latitude: result.latitude,
                longitude: result.longitude,
                name: result.ip,
                fillKey: "point",
                radius: 2
            })
        }
    })
    map.bubbles(bubbles)
}

/**
 * Creates a status label for use in the results datatable
 * @param {string} status
 */
function createStatusLabel(status) {
    var label = statuses[status].label || "label-default";
    var statusColumn = "<span class=\"label " + label + "\">" + status + "</span>"
    return statusColumn
}

/* poll - Queries the API and updates the UI with the results
 *
 * Updates:
 * * Timeline Chart
 * * Hostname (Donut) Chart
 * * Map Bubbles
 * * Datatables
 */
function poll() {
    api.campaignId.results(campaign.id)
        .success(function (c) {
            campaign = c
            /* Update the timeline */
            var timeline_series_data = []
            $.each(campaign.timeline, function (i, event) {
                var event_date = moment.utc(event.time).local()
                timeline_series_data.push({
                    hostname: event.hostname,
                    message: event.message,
                    x: event_date.valueOf(),
                    y: 1,
                    marker: {
                        fillColor: statuses[event.message].color
                    }
                })
            })
            var timeline_chart = $("#timeline_chart").highcharts()
            timeline_chart.series[0].update({
                data: timeline_series_data
            })
            /* Update the results donut chart */
            var target_series_data = {}
            // Load the initial data
            Object.keys(statusMapping).forEach(function (k) {
                target_series_data[k] = 0
            });
            $.each(campaign.results, function (i, result) {
                target_series_data[result.status]++;
                // Backfill status values
                var step = progressListing.indexOf(result.status)
                for (var i = 0; i < step; i++) {
                    target_series_data[progressListing[i]]++
                }
            })
            $.each(target_series_data, function (status, count) {
                var target_data = []
                if (!(status in statusMapping) || (status == "Opened Everything")) {
                    return true
                }
                target_data.push({
                    name: status,
                    y: Math.floor((count / campaign.results.length) * 100),
                    count: count
                })
                target_data.push({
                    name: '',
                    y: 100 - Math.floor((count / campaign.results.length) * 100)
                })
                var chart = $("#" + statusMapping[status] + "_chart").highcharts()
                chart.series[0].update({
                    data: target_data
                })
            })

            /* Update the datatable */
            resultsTable = $("#resultsTable").DataTable()
            resultsTable.rows().every(function (i, tableLoop, rowLoop) {
                var row = this.row(i)
                var rowData = row.data()
                var rid = rowData[0]
                $.each(campaign.results, function (j, result) {
                    if (result.id == rid) {
                        rowData[6] = result.status
                        resultsTable.row(i).data(rowData)
                        if (row.child.isShown()) {
                            $(row.node()).find("#caret").removeClass("fa-caret-right")
                            $(row.node()).find("#caret").addClass("fa-caret-down")
                            row.child(renderTimeline(row.data()))
                        }
                        return false
                    }
                })
            })
            resultsTable.draw(false)
            /* Update the map information */
            updateMap(campaign.results)
            $('[data-toggle="tooltip"]').tooltip()
            $("#refresh_message").hide()
            $("#refresh_btn").show()
        })
}

function load() {
    campaign.id = window.location.pathname.split('/').slice(-1)[0]
    var use_map = JSON.parse(localStorage.getItem('gophishusb.use_map'))
    api.campaignId.results(campaign.id)
        .success(function (c) {
            campaign = c
            if (campaign) {
                $("title").text(c.name + " - GophishUSB")
                $("#loading").hide()
                $("#campaignResults").show()
                // Set the title
                $("#page-title").text("Results for " + c.name)
                if (c.status == "Completed") {
                    $('#complete_button')[0].disabled = true;
                    $('#complete_button').text('Completed!');
                    doPoll = false;
                }
                // Setup viewing the details of a result
                $("#resultsTable").on("click", ".timeline-event-details", function () {
                    // Show the parameters
                    payloadResults = $(this).parent().find(".timeline-event-results")
                    if (payloadResults.is(":visible")) {
                        $(this).find("i").removeClass("fa-caret-down")
                        $(this).find("i").addClass("fa-caret-right")
                        payloadResults.hide()
                    } else {
                        $(this).find("i").removeClass("fa-caret-right")
                        $(this).find("i").addClass("fa-caret-down")
                        payloadResults.show()
                    }
                })
                // Setup the results table
                resultsTable = $("#resultsTable").DataTable({
                    destroy: true,
                    "order": [
                        [0, "asc"]
                    ],
                    columns: [
                        { title: "Target ID" },
                        { title: "", className: "details-control" },
                        { title: "Hostname" },
                        { title: "OS" },
                        { title: "Last User" },
                        { title: "Status" }
                    ],
                    columnDefs: [{
                            orderable: false,
                            targets: "no-sort"
                        }, {
                            className: "details-control",
                            "targets": [1]
                        }, {
                            "visible": true,
                            "targets": [0, 5]
                        },
                        {
                            "render": function (data) {
                                return createStatusLabel(data)
                            },
                            "targets": [5]
                        }
                    ]
                });
                resultsTable.clear();
                var target_series_data = {}
                var timeline_series_data = []
                Object.keys(statusMapping).forEach(function (k) {
                    target_series_data[k] = 0
                });
                $.each(campaign.results, function (i, result) {
                    resultsTable.row.add([
                        result.target_id,
                        "<i id=\"caret\" class=\"fa fa-caret-right\"></i>",
                        escapeHtml(result.hostname) || "",
                        escapeHtml(result.os) || "",
                        escapeHtml(result.username) || "",
                        result.status
                    ])
                    target_series_data[result.status]++;
                    // Backfill status values
                    var step = progressListing.indexOf(result.status)
                    for (var i = 0; i < step; i++) {
                        target_series_data[progressListing[i]]++
                    }
                })
                resultsTable.draw();
                // Setup tooltips
                $('[data-toggle="tooltip"]').tooltip()
                // Setup the individual timelines
                $('#resultsTable tbody').on('click', 'td.details-control', function () {
                    var tr = $(this).closest('tr');
                    var row = resultsTable.row(tr);
                    if (row.child.isShown()) {
                        // This row is already open - close it
                        row.child.hide();
                        tr.removeClass('shown');
                        $(this).find("i").removeClass("fa-caret-down")
                        $(this).find("i").addClass("fa-caret-right")
                    } else {
                        // Open this row
                        $(this).find("i").removeClass("fa-caret-right")
                        $(this).find("i").addClass("fa-caret-down")
                        row.child(renderTimeline(row.data())).show();
                        tr.addClass('shown');
                    }
                });
                // Setup the graphs
                $.each(campaign.timeline, function (i, event) {
                    if (event.message == "Campaign Created") {
                        return true
                    }
                    var event_date = moment.utc(event.time).local()
                    timeline_series_data.push({
                        hostname: event.hostname,
                        username: event.username,
                        message: event.message,
                        x: event_date.valueOf(),
                        y: 1,
                        marker: {
                            fillColor: statuses[event.message].color
                        }
                    })
                })
                renderTimelineChart({
                    data: timeline_series_data
                })
                $.each(target_series_data, function (status, count) {
                    var target_data = []
                    if (!(status in statusMapping) || (status == "Opened Everything")) {
                        return true
                    }
                    target_data.push({
                        name: status,
                        y: Math.floor((count / campaign.results.length) * 100),
                        count: count
                    })
                    target_data.push({
                        name: '',
                        y: 100 - Math.floor((count / campaign.results.length) * 100)
                    })
                    var chart = renderPieChart({
                        elemId: statusMapping[status] + '_chart',
                        title: status,
                        name: status,
                        data: target_data,
                        colors: [statuses[status].color, '#dddddd']
                    })
                })

                if (use_map) {
                    $("#resultsMapContainer").show()
                    map = new Datamap({
                        element: document.getElementById("resultsMap"),
                        responsive: true,
                        fills: {
                            defaultFill: "#ffffff",
                            point: "#283F50"
                        },
                        geographyConfig: {
                            highlightFillColor: "#1abc9c",
                            borderColor: "#283F50"
                        },
                        bubblesConfig: {
                            borderColor: "#283F50"
                        }
                    });
                }
                updateMap(campaign.results)
            }
        })
        .error(function () {
            $("#loading").hide()
            errorFlash("Campaign not found!")
        })
}

var setRefresh

function refresh() {
    if (!doPoll) {
        return;
    }
    $("#refresh_message").show()
    $("#refresh_btn").hide()
    poll()
    clearTimeout(setRefresh)
    setRefresh = setTimeout(refresh, 60000)
};

$(document).ready(function () {
    Highcharts.setOptions({
        global: {
            useUTC: false
        }
    })
    load();

    // Start the polling loop
    setRefresh = setTimeout(refresh, 60000)
})
