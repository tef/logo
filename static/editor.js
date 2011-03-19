var oldContent = "";
var changeTimeout;
var dmp = new diff_match_patch();
var channel;
var channelReady = false;
var foo;
var clientID;

tinyMCE.init({
    mode: "textareas",
    theme: "advanced",
    //Disable the toolbar.
    theme_advanced_layout_manager: "RowLayout",
    theme_advanced_containers: "editorcontainer",
    theme_advanced_container_editorcontainer: "mceEditor",
    custom_shortcuts: true,
    forced_root_block: false, 
    force_br_newlines: true, 
    force_p_newlines: false,
    content_css: '/static/editor.css',
    setup: function(ed) {
      ed.addCommand('Dummy', function() {
        //Do nothing.
      });

      ed.onKeyDown.add(function(ed, e) {
        if (changeTimeout) {
          clearTimeout(changeTimeout);
        }
        changeTimeout = setTimeout(sendPatches, 300);
      });
    },
    oninit: function() {
      var ed = tinyMCE.get('code');
      oldContent = getPlainCode();
      //Stop users from applying formats themselves.
      ed.addShortcut("ctrl+b", "nix", "Dummy");
      ed.addShortcut("ctrl+i", "nix", "Dummy");
      ed.addShortcut("ctrl+u", "nix", "Dummy");
      run(1,false);
    }
});

function getPlainCode() {
  var ed = tinyMCE.get('code');
  var oldSel = ed.selection.getRng();
  ed.selection.select(ed.getBody());
  var code = ed.selection.getContent({format: 'text'});
  ed.selection.setRng(oldSel);
  return code
}

function applyPatches(patches) {
  sendPatches();
  var currentCode = getPlainCode();
  var results = dmp.patch_apply(dmp.patch_fromText(patches), currentCode);
  var newCode = results[0];
  var ed = tinyMCE.get('code');
  ed.setContent(newCode.replace(/\n/g, "<br/>"));
  oldContent = getPlainCode();
}

function sendPatches() {
  var newContent = getPlainCode();
  if (newContent != oldContent) {
    var patches = dmp.patch_toText(dmp.patch_make(oldContent, newContent));
    //document.getElementById('diff').innerHTML = dmp.patch_toText(patches);
    
    var xhr = new XMLHttpRequest();
    xhr.open('POST', '', true);
    xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    xhr.send('patches='+encodeURIComponent(patches) + 
             '&client_id='+encodeURIComponent(clientID));
    oldContent = newContent;
  }
}

function openChannel(token, newClientID) {
  clientID = newClientID;
  channel = new goog.appengine.Channel(token);
  var socket = channel.open();
  socket.onopen = function(){channelReady = true};
  socket.onmessage = function(message){applyPatches(message.data);};
  //socket.onerror = function(error){alert(error.description);};
}
