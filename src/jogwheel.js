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
  };
  websocket.onclose = function(evt) {
    console.log("disconnected from jogwheel\n");
  };
  websocket.onmessage = function(evt) {
    console.log("jogwheel message: " + evt.data + '\n');
    var data = JSON.parse(evt.data);
    if (data.localip != undefined) {

    } else {
        var clicks = data.amount;
        console.log("clicks: " + clicks);
        var axis = view.getJogAxis();
        var jogIncrement = view.getJogIncrement();
        console.log("jogIncrement: " + jogIncrement);
        var jogDistance = clicks * jogIncrement;
        console.log("jogDistance: " + jogDistance);
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
