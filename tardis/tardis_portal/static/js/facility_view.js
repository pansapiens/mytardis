// Capitalises the first letter (adapted from http://codepen.io/WinterJoey/pen/sfFaK)
app.filter('capitalise', function () {
    return function (input, all) {
        return (!!input) ? input.replace(/([^\W_]+[^\s-]*) */g, function (txt) {
            return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
        }) : '';
    }
});

// Filter to produce nice file size formatting (adapted from https://gist.github.com/yrezgui/5653591)
app.filter('filesize', function () {
    var units = [
        'bytes',
        'KB',
        'MB',
        'GB',
        'TB',
        'PB'
    ];

    return function (bytes, precision) {
        if (isNaN(parseFloat(bytes)) || !isFinite(bytes)) {
            return '?';
        }

        var unit = 0;

        while (bytes >= 1024) {
            bytes /= 1024;
            unit++;
        }

        return bytes.toFixed(+precision) + ' ' + units[unit];
    };
});


app.controller('FacilityCtrl', function ($scope, $resource, $interval, $log) {

    var countRes = $resource('/facility/fetch_data/:facility_id/count/');
    var datasetDetailRes = $resource('/facility/fetch_datafiles/:dataset_id/',
        {}, {
            'get': {method: 'GET', isArray: true}
        });
    var facilityListRes = $resource('/facility/fetch_facilities_list/', {}, {
        'get': {method: 'GET', isArray: true}
    });
    var facilityDataRes = $resource('/facility/fetch_data/:facility_id/:start_index/:end_index/', {
        start_index: 0,
        end_index: 50
    }, {
        'get': {method: 'GET', isArray: true}
    });

    // Whether to show the "no data" alert
    $scope.showDataUnvailableAlert = function () {
        if ($scope.loading) {
            return false;
        } else if (typeof $scope.datasets !== 'undefined') {
            return $scope.datasets.length === 0;
        } else {
            return true;
        }
    };

    // Whether to show the facility selector
    $scope.showFacilitySelector = function () {
        return ($scope.facilities.length > 1);
    };
    // Toggle the facility selector
    $scope.selectFacility = function (id, name) {
        $scope.selectedFacility = id;
        $scope.selectedFacilityName = name;
        $scope.currentFetchLimit = $scope.defaultFetchLimit;
        $scope.fetchFacilityData(0, $scope.currentFetchLimit);
    };
    // Check which facility is selected
    $scope.isFacilitySelected = function (id) {
        return $scope.selectedFacility === id;
    };

    // Toggle data view selector
    $scope.selectDataView = function (index) {
        $scope.selectedDataView = index;
    };
    // Check which data view is selected
    $scope.isDataViewSelected = function (index) {
        return $scope.selectedDataView === index;
    };

    // Toggle file list visibility
    $scope.toggleFileList = function (dataset) {
        if ($scope.visibleFileList === dataset.id) {
            delete $scope.visibleFileList;
        } else {
            $scope.visibleFileList = dataset.id;
            datasetDetailRes.get({'dataset_id': dataset.id}).$promise.then(function (data) {
                dataset.datafiles = data;
            });
        }
    };
    // Check if file list is visible
    $scope.isFileListVisible = function (id) {
        return $scope.visibleFileList === id;
    };
    $scope.unsetFileListVisibility = function () {
        delete $scope.visibleFileList;
    };

    // Reset filter form
    $scope.filterFormReset = function () {
        delete $scope.search_owner;
        delete $scope.search_experiment;
        delete $scope.search_instrument;
    };
    // Check if filters are active
    $scope.filtersActive = function () {
        if (typeof $scope.search_owner !== 'undefined' && $scope.search_owner.owner) {
            return true;
        } else if (typeof $scope.search_experiment !== 'undefined' && $scope.search_experiment.parent_experiment.title) {
            return true;
        } else if (typeof $scope.search_instrument !== 'undefined' && $scope.search_instrument.instrument.name) {
            return true;
        }
    };

    // Load more entries
    $scope.loadMoreEntries = function (increment) {
        if ($scope.currentFetchLimit >= $scope.totalDatasets) {
            return;
        }
        if ($scope.currentFetchLimit + increment > $scope.totalDatasets) {
            $scope.currentFetchLimit = $scope.totalDatasets;
        } else {
            $scope.currentFetchLimit += increment;
        }
        $scope.fetchFacilityData($scope.datasets.length, $scope.currentFetchLimit, true);
    };

    // Fetch the list of facilities available to the user and facilities data
    function initialiseFacilitiesData() {
        facilityListRes.get().$promise.then(function (data) {
                $log.debug("Facility list fetched successfully");
                $scope.facilities = data;
                if ($scope.facilities.length > 0) { // If the user is allowed to manage any facilities...
                    $scope.selectedFacility = $scope.facilities[0].id;
                    $scope.selectedFacilityName = $scope.facilities[0].name;
                    $scope.fetchFacilityData(0, $scope.defaultFetchLimit);
                }
            },
            function () {
                $log.error("Could not load facility list");
            });
    }

    // Fetch data for facility
    $scope.fetchFacilityData = function (startIndex, endIndex, append) {

        delete $scope.visibleFileList;
        $scope.loading = true;

        countRes.get({'facility_id': $scope.selectedFacility}).$promise.then(function (data) {
                $log.debug("Fetched total dataset count");
                $scope.totalDatasets = data.facility_data_count;
                if ($scope.currentFetchLimit > $scope.totalDatasets) {
                    $scope.currentFetchLimit = $scope.totalDatasets;
                }
            },
            function () {
                $log.error("Could not fetch total dataset count");
            });

        facilityDataRes.get({
            'facility_id': $scope.selectedFacility,
            'start_index': startIndex,
            'end_index': endIndex
        }).$promise.then(function (data) {
            $log.debug("Fetched datasets between indices " + startIndex + " and " + endIndex);
            if (append && $scope.datasets) {
                $scope.datasets = $scope.datasets.concat(data.slice(0, data.length));
            } else {
                $scope.datasets = data.slice(0, data.length);
            }
            if ($scope.datasets.length > 0) {
                $scope.dataByUser = groupByUser($scope.datasets);
                $scope.dataByInstrument = groupByInstrument($scope.datasets);
            } else {
                $scope.dataByUser = [];
                $scope.dataByInstrument = [];
            }
        },
        function () {
            $log.error("Could not fetch datasets");
        })
        .finally(function () {
            $scope.loading = false;
        });
    };

    // Group facilities data by user
    function groupByUser(data) {
        // Sort by username, group name
        data.sort(function (a, b) {
            var aOwnerGroup = a.owner + ', ' + a.group;
            var bOwnerGroup = b.owner + ', ' + b.group;
            if (aOwnerGroup < bOwnerGroup) {
                return -1;
            } else if (aOwnerGroup > bOwnerGroup) {
                return 1;
            } else {
                return 0;
            }
        });

        var result = [];
        if (data[0].group) {
            data[0].ownerGroup = data[0].owner + ', ' + data[0].group;
        }
        else {
            data[0].ownerGroup = data[0].owner
        }
        var tmp = {"ownerGroup": data[0].ownerGroup};
        tmp['datasets'] = [];
        for (var i = 0; i < data.length; i++) {
            data[i].ownerGroup = data[i].owner + ', ' + data[i].group;
            if (data[i].group) {
                data[i].ownerGroup = data[i].owner + ', ' + data[i].group;
            }
            else {
                data[i].ownerGroup = data[i].owner
            }
            if (tmp.ownerGroup !== data[i].ownerGroup) {
                result.push(tmp);
                tmp = {"ownerGroup": data[i].ownerGroup};
                tmp['datasets'] = [];
            }
            var dataset = {};
            for (var key in data[i]) {
                if (key !== "ownerGroup") {
                    dataset[key] = data[i][key];
                }
            }
            tmp['datasets'].push(dataset);
        }
        result.push(tmp);
        return result;
    }

    // Group facilities data by instrument
    function groupByInstrument(data) {
        // Sort by instrument ID
        data.sort(function (a, b) {
            return a.instrument.id - b.instrument.id;
        });

        var result = [];
        var tmp = {"instrument": data[0].instrument};
        tmp['datasets'] = [];
        for (var i = 0; i < data.length; i++) {
            if (tmp.instrument.id !== data[i].instrument.id) {
                result.push(tmp);
                tmp = {"instrument": data[i].instrument};
                tmp['datasets'] = [];
            }
            var dataset = {};
            for (var key in data[i]) {
                if (key !== "instrument") {
                    dataset[key] = data[i][key];
                }
            }
            tmp['datasets'].push(dataset);
        }
        result.push(tmp);
        return result;
    }

    // Refresh polling timer
    $interval(function () {
        if ($scope.refreshCountdown > 0 && $scope.refreshInterval > 0) {
            $scope.refreshCountdown--;
        } else if ($scope.refreshInterval > 0) {
            delete $scope.visibleFileList;
            $scope.fetchFacilityData(0, $scope.currentFetchLimit);
            $scope.refreshCountdown = $scope.refreshInterval;
        }
    }, 1000);

    // Set the update interval
    $scope.setRefreshInterval = function (interval) {
        $scope.refreshInterval = interval;
        $scope.refreshCountdown = interval;
    };

    // Format the countdown for the view (mm:ss)
    $scope.refreshCountdownFmt = function () {
        var minutes = Math.floor($scope.refreshCountdown / 60);
        var seconds = $scope.refreshCountdown - minutes * 60;
        var strMins, strSecs;
        if (minutes < 10) {
            strMins = "0" + minutes;
        } else {
            strMins = minutes;
        }
        if (seconds < 10) {
            strSecs = "0" + seconds;
        } else {
            strSecs = seconds;
        }
        return strMins + ":" + strSecs;
    };

    // Set default settings
    $scope.defaultFetchLimit = 50;
    $scope.currentFetchLimit = $scope.defaultFetchLimit;
    $scope.facilities = [];
    $scope.selectedDataView = 1;
    $scope.refreshInterval = 0;
    $scope.refreshCountdown = 0;

    // Do initial data fetch
    initialiseFacilitiesData();

});
