$(function() {
var root = window;
var cnc = root.cnc || {};
var controller = cnc.controller;
var settings = {};
var hostname = window.location.hostname;
var view = root.view || {};

if (hostname == 'localhost' || hostname == '127.0.0.1') {
  settings.url = "ws://" + hostname + ":8000/";

  root.websocket = new WebSocket(settings.url);
  var websocket = root.websocket;

  websocket.onopen = function(evt) {
    console.log("connected to jogwheel\n");
    websocket.send(JSON.stringify({}));
  };
  websocket.onclose = function(evt) {
    console.log("disconnected from jogwheel\n");
  };
  websocket.onmessage = function(evt) {
    var data = JSON.parse(evt.data);
    if (data.localIp != undefined) {
        view.setLocalIp(data.localIp);
    } else {
        var clicks = data.amount;
        var axis = view.getJogAxis();
        var jogIncrement = view.getJogIncrement();
        var jogDistance = clicks * jogIncrement;
        var jogObj = {};

        jogObj[axis] = jogDistance;
        cnc.jog(jogObj);
    }
  };
  websocket.onerror = function(evt) {
    console.log("jogwheel error: " + evt.data + '\n');

    websocket.close();
  };
  websocket.doDisconnect = function() {
    websocket.close();
  }
}


});
