$(function() {
var root = window;
var cnc = root.cnc || {};
var controller = cnc.controller;
var view = {};
root.view = view;
cnc.units = 'mm';

view.getJogAxis = function() {
  return cnc.jogAxis;
};

cnc.updateModalView = function(units) {
  cnc.units = units;
  $('[data-route="axes"] [data-name="travelToTile"]').text("Travel to WPos " + view.getJogAxis() + " (" + units + "):");
}

cnc.setJogAxis = function(axis) {
  cnc.jogAxis = axis;
  cnc.updateModalView(cnc.units);
};

cnc.setJogIncrement = function(increment) {
  return cnc.jogIncrement = increment;
};

cnc.setJogAxis("X");
cnc.setJogIncrement(.1);

var ACTIVE_STATE_HOLD = 'Hold';

$( "body" ).keyup(function(event) {
  if ( event.which == 27 ) { // escape
    controller.command('feedhold');
    return;
  }

  if ( event.which == 192 ) { // tilde / grave
    if (controller.state.status.activeState == ACTIVE_STATE_HOLD) {
      controller.command('cyclestart');
    } else {
      controller.command('feedhold');
    }
    return;
  }
});

controller.on('serialport:list', function(list) {
    var $el = $('[data-route="connection"] select[data-name="port"]');

    $el.empty();
    $.each(list, function(key, value) {
        var $option = $('<option></option>')
            .attr('value', value.port)
            .attr('data-inuse', value.inuse)
            .text(value.port);
        $el.append($option);
    });

    if (cnc.controllerType) {
        $('[data-route="connection"] select[data-name="controllerType"]').val(cnc.controllerType);
    }
    if (cnc.port) {
        $('[data-route="connection"] select[data-name="port"]').val(cnc.port);
    }
    if (cnc.baudrate) {
        $('[data-route="connection"] select[data-name="baudrate"]').val(cnc.baudrate);
    }

    // KLC: fix this later
    var controllerType = 'Grbl';
    var port = '/dev/ttyUSB0';
    var baudrate = 115200;

    controller.openPort(port, {
        controllerType: controllerType,
        baudrate: Number(baudrate)
    });

});

controller.on('serialport:open', function(options) {
    var controllerType = options.controllerType;
    var port = options.port;
    var baudrate = options.baudrate;

    console.log('Connected to \'' + port + '\' at ' + baudrate + '.');

    cnc.connected = true;
    cnc.controllerType = controllerType;
    cnc.port = port;
    cnc.baudrate = baudrate;

    $('[data-route="workspace"] [data-name="port"]').val(port);

    Cookies.set('cnc.controllerType', controllerType);
    Cookies.set('cnc.port', port);
    Cookies.set('cnc.baudrate', baudrate);

    root.location = '#/axes';
});

controller.on('startup', (res) => {
  if (cnc.controllerType === 'Grbl') {
      controller.writeln('$$');
  }
});

controller.on('serialport:close', function(options) {
    var port = options.port;

    console.log('Disconnected from \'' + port + '\'.');

    cnc.connected = false;
    cnc.controllerType = '';
    cnc.port = '';
    cnc.baudrate = 0;

    $('[data-route="workspace"] [data-name="port"]').val('');
    $('[data-route="axes"] [data-name="active-state"]').text('Not connected');

    root.location = '#/connection';
});

controller.on('serialport:error', function(options) {
    var port = options.port;

    console.log('Error opening serial port \'' + port + '\'');

    $('[data-route="connection"] [data-name="msg"]').html('<p style="color: red">Error opening serial port \'' + port + '\'</p>');

});

// cnc.jog({X: distance});
cnc.jog = function(params) {
    params = params || {};
    var s = _.map(params, (value, letter) => {
        return '' + letter + value;
    }).join(' ');
    console.log('G91 G0 ' + s);
    controller.command('gcode', 'G91 G0 ' + s); // relative distance
    controller.command('gcode', 'G90'); // absolute distance
};

view.getJogIncrement = function() {
  return cnc.jogIncrement;
};


cnc.sendJogAxis = function(dir) {
  cnc.sendMove('' + cnc.jogAxis + dir);
}

cnc.zeroMachine = function() {
  controller.command('gcode', 'G10 L20 P1 ' + cnc.jogAxis + '0');
}

cnc.move = function(params) {
  params = params || {};
  var s = _.map(params, (value, letter) => {
      return '' + letter + value;
  }).join(' ');
  controller.command('gcode', 'G0 ' + s);
}

cnc.sendMove = function(cmd) {
    var distance = view.getJogIncrement();

    var fn = {
        'G28': function() {
            controller.command('gcode', 'G28');
        },
        'G30': function() {
            controller.command('gcode', 'G30 P1');
        },
        'X0Y0Z0': function() {
            cnc.move({ X: 0, Y: 0, Z: 0 })
        },
        'X0': function() {
            cnc.move({ X: 0 });
        },
        'Y0': function() {
            cnc.move({ Y: 0 });
        },
        'Z0': function() {
            cnc.move({ Z: 0 });
        },
        'X-Y+': function() {
            cnc.jog({ X: -distance, Y: distance });
        },
        'X+Y+': function() {
            cnc.jog({ X: distance, Y: distance });
        },
        'X-Y-': function() {
            cnc.jog({ X: -distance, Y: -distance });
        },
        'X+Y-': function() {
            cnc.jog({ X: distance, Y: -distance });
        },
        'X-': function() {
            cnc.jog({ X: -distance });
        },
        'X+': function() {
            cnc.jog({ X: distance });
        },
        'Y-': function() {
            cnc.jog({ Y: -distance });
        },
        'Y+': function() {
            cnc.jog({ Y: distance });
        },
        'Z-': function() {
            cnc.jog({ Z: -distance });
        },
        'Z+': function() {
            cnc.jog({ Z: distance });
        }
    }[cmd];

    fn && fn();
};

controller.on('serialport:read', function(data) {
    var style = 'font-weight: bold; line-height: 20px; padding: 2px 4px; border: 1px solid; color: #222; background: #F5F5F5';
    console.log('%cR%c', style, '', data);
});

// GRBL reports position in units according to the $13 setting,
// independent of the GCode in/mm parser state.
// We track the $13 value by watching for the Grbl:settings event and by
// watching for manual changes via serialport:write.  Upon initial connection,
// we issue a settings request in serialport:open.
var grblReportingUnits;  // initially undefined

controller.on('serialport:write', function(data) {
    var style = 'font-weight: bold; line-height: 20px; padding: 2px 4px; border: 1px solid; color: #00529B; background: #BDE5F8';
    console.log('%cW%c', style, '', data);

    // Track manual changes to the Grbl position reporting units setting
    // We are looking for either $13=0 or $13=1
    if (cnc.controllerType === 'Grbl') {
        cmd = data.split('=');
        if (cmd.length === 2 && cmd[0] === "$13") {
            grblReportingUnits = Number(cmd[1]) || 0;
        }
    }
});

// This is a copy of the Grbl:state report that came in before the Grbl:settings report
var savedGrblState;

function renderGrblState(data) {
    var status = data.status || {};
    var activeState = status.activeState;
    var mpos = status.mpos;
    var wpos = status.wpos;
    var IDLE = 'Idle', RUN = 'Run';
    var canClick = [IDLE, RUN].indexOf(activeState) >= 0;

    var parserstate = data.parserstate || {};

    // Unit conversion factor - depends on both $13 setting and parser units
    var factor = 1.0;
    // Number of postdecimal digits to display; 3 for in, 4 for mm
    var digits = 4;

    var mlabel = 'MPos:';
    var wlabel = 'WPos:';
    var units = "mm";
    switch (parserstate.modal.units) {
    case 'G20':
        digits = 4;
        factor = grblReportingUnits === 0 ? 1/25.4 : 1.0 ;
        units = "in"
        break;
    case 'G21':
        digits = 3;
        factor = grblReportingUnits === 0 ? 1.0 : 25.4;
        break;
    }

    mlabel = 'MPos (' + units + '):';
    wlabel = 'WPos (' + units + '):';

    cnc.updateModalView(units);

    //console.log(grblReportingUnits, factor);

    mpos.x = (mpos.x * factor).toFixed(digits);
    mpos.y = (mpos.y * factor).toFixed(digits);
    mpos.z = (mpos.z * factor).toFixed(digits);

    wpos.x = (wpos.x * factor).toFixed(digits);
    wpos.y = (wpos.y * factor).toFixed(digits);
    wpos.z = (wpos.z * factor).toFixed(digits);

    $('[data-route="axes"] .control-pad .btn').prop('disabled', !canClick);
    $('[data-route="axes"] [data-name="active-state"]').text(activeState);
    $('[data-route="axes"] [data-name="mpos-label"]').text(mlabel);
    $('[data-route="axes"] [data-name="mpos-x"]').text(mpos.x);
    $('[data-route="axes"] [data-name="mpos-y"]').text(mpos.y);
    $('[data-route="axes"] [data-name="mpos-z"]').text(mpos.z);
    $('[data-route="axes"] [data-name="wpos-label"]').text(wlabel);
    $('[data-route="axes"] [data-name="wpos-x"]').text(wpos.x);
    $('[data-route="axes"] [data-name="wpos-y"]').text(wpos.y);
    $('[data-route="axes"] [data-name="wpos-z"]').text(wpos.z);
}

controller.on('Grbl:state', function(data) {
    // If we do not yet know the reporting units from the $13 setting, we copy
    // the data for later processing when we do know.
    if (typeof grblReportingUnits === 'undefined') {
        savedGrblState = JSON.parse(JSON.stringify(data));
    } else {
        renderGrblState(data);
    }
});

controller.on('Grbl:settings', function(data) {
    var settings = data.settings || {};
    if (settings['$13'] !== undefined) {
        grblReportingUnits = Number(settings['$13']) || 0;

        if (typeof savedGrblState !== 'undefined') {
            renderGrblState(savedGrblState);
            // Don't re-render the state if we get later settings reports,
            // as the savedGrblState is probably stale.
            savedGrblState = undefined;
        }
    }
});

controller.on('Smoothie:state', function(data) {
    var status = data.status || {};
    var activeState = status.activeState;
    var mpos = status.mpos;
    var wpos = status.wpos;
    var IDLE = 'Idle', RUN = 'Run';
    var canClick = [IDLE, RUN].indexOf(activeState) >= 0;

    $('[data-route="axes"] .control-pad .btn').prop('disabled', !canClick);
    $('[data-route="axes"] [data-name="active-state"]').text(activeState);
    $('[data-route="axes"] [data-name="mpos-x"]').text(mpos.x);
    $('[data-route="axes"] [data-name="mpos-y"]').text(mpos.y);
    $('[data-route="axes"] [data-name="mpos-z"]').text(mpos.z);
    $('[data-route="axes"] [data-name="wpos-x"]').text(wpos.x);
    $('[data-route="axes"] [data-name="wpos-y"]').text(wpos.y);
    $('[data-route="axes"] [data-name="wpos-z"]').text(wpos.z);
    cnc.updateModalView('unknown units');
});

controller.on('TinyG:state', function(data) {
    var sr = data.sr || {};
    var machineState = sr.machineState;
    var stateText = {
        0: 'Initializing',
        1: 'Ready',
        2: 'Alarm',
        3: 'Program Stop',
        4: 'Program End',
        5: 'Run',
        6: 'Hold',
        7: 'Probe',
        8: 'Cycle',
        9: 'Homing',
        10: 'Jog',
        11: 'Interlock',
    }[machineState] || 'N/A';
    var mpos = sr.mpos;
    var wpos = sr.wpos;
    var READY = 1, STOP = 3, END = 4, RUN = 5;
    var canClick = [READY, STOP, END, RUN].indexOf(machineState) >= 0;
    var mlabel = 'MPos:';
    var wlabel = 'WPos:';
    var units = 'mm';
    switch (sr.modal.units) {
    case 'G20':
        mlabel = 'MPos (in):';
        wlabel = 'WPos (in):';
        // TinyG reports machine coordinates in mm regardless of the in/mm mode
        mpos.x = (mpos.x / 25.4).toFixed(4);
        mpos.y = (mpos.y / 25.4).toFixed(4);
        mpos.z = (mpos.z / 25.4).toFixed(4);
        // TinyG reports work coordinates according to the in/mm mode
        wpos.x = Number(wpos.x).toFixed(4);
        wpos.y = Number(wpos.y).toFixed(4);
        wpos.z = Number(wpos.z).toFixed(4);
        units = "in";
        break;
    case 'G21':
        mlabel = 'MPos (mm):';
        wlabel = 'WPos (mm):';
        mpos.x = Number(mpos.x).toFixed(3);
        mpos.y = Number(mpos.y).toFixed(3);
        mpos.z = Number(mpos.z).toFixed(3);
        wpos.x = Number(wpos.x).toFixed(3);
        wpos.y = Number(wpos.y).toFixed(3);
        wpos.z = Number(wpos.z).toFixed(3);
    }
    cnc.updateModalView(units);

    $('[data-route="axes"] .control-pad .btn').prop('disabled', !canClick);
    $('[data-route="axes"] [data-name="active-state"]').text(stateText);
    $('[data-route="axes"] [data-name="mpos-label"]').text(mlabel);
    $('[data-route="axes"] [data-name="mpos-x"]').text(mpos.x);
    $('[data-route="axes"] [data-name="mpos-y"]').text(mpos.y);
    $('[data-route="axes"] [data-name="mpos-z"]').text(mpos.z);
    $('[data-route="axes"] [data-name="wpos-label"]').text(wlabel);
    $('[data-route="axes"] [data-name="wpos-x"]').text(wpos.x);
    $('[data-route="axes"] [data-name="wpos-y"]').text(wpos.y);
    $('[data-route="axes"] [data-name="wpos-z"]').text(wpos.z);
});

controller.listAllPorts();

// Workspace
$('[data-route="workspace"] [data-name="port"]').val('');
$('[data-route="workspace"] [data-name="btn-close"]').on('click', function() {
    controller.closePort();
});

//
// Connection
//
$('[data-route="connection"] [data-name="btn-open"]').on('click', function() {
    var controllerType = $('[data-route="connection"] [data-name="controllerType"]').val();
    var port = $('[data-route="connection"] [data-name="port"]').val();
    var baudrate = $('[data-route="connection"] [data-name="baudrate"]').val();

    $('[data-route="connection"] [data-name="msg"]').val('');
    controller.openPort(port, {
        controllerType: controllerType,
        baudrate: Number(baudrate)
    });
});

//
// Axes
//
$('[data-route="axes"] [data-name="btn-dropdown"]').dropdown();
$('[data-route="axes"] [data-name="active-state"]').text('Not connected');
$('[data-route="axes"] select[data-name="select-distance"]').val('1');

view.modalFresh = false;

$('#myModal').on('shown.bs.modal', function () {
    setTimeout(function (){
        view.modalFresh = true;
        $('#travelToInput').focus();
    }, 100);
});

$("#travelToInput").keydown(function(event) {
    if (event.keyCode === 13) {
    } else if (view.modalFresh) {
        $('#travelToInput').val("");
    }
    view.modalFresh = false;
});

$("#travelToInput").keyup(function(event) {
    if (event.keyCode === 13) {
        $("#myModalOk").click();
    }
});

$(document).keydown(function (e) {
    switch (e.keyCode) {
        case 37: // left
            cnc.sendMove("X+");
            break;
        case 39: // right
            cnc.sendMove("X-");
            break;
        case 38: // up
            cnc.sendMove("Y-");
            break;
        case 40: // down
            cnc.sendMove("Y+");
            break;
        case 33: // page up
            cnc.sendMove("Z+");
            break;
        case 34: // page down
            cnc.sendMove("Z-");
            break;
    }
});

});
