const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function setup(t) {
  const nodes = new Map();
  const events = {};
  const node = (id) => {
    if (!nodes.has(id)) nodes.set(id, {dataset:{},children:[],hidden:false,width:640,height:480,
      setAttribute(){}, getContext:()=>({clearRect(){},strokeRect(){}}),
      prepend(){}, replaceChildren(){}});
    return nodes.get(id);
  };
  const sockets=[];
  class Socket {
    static OPEN=1;
    constructor(){this.readyState=1;sockets.push(this);}
    close() {this.onclose?.();}
    send(value){this.sent=value;}
  }
  class Camera {update(){} stop(){}}
  const context = vm.createContext({
    document:{getElementById:node,querySelectorAll:()=>[],createElement:()=>node('li'),
              addEventListener:(name,fn)=>{events[name]=fn;}},
    window:{location:{href:'http://localhost:8000/'},addEventListener:(name,fn)=>{events[name]=fn;}},
    location:{protocol:'http:'},WebSocket:Socket,CameraController:Camera,
    URL,Date,setTimeout,clearTimeout
  });
  vm.runInContext(fs.readFileSync('simulator/app.js','utf8'),context);
  t.after(()=>events.pagehide());
  const state = {protocol_version:4,type:'state',monitoring_enabled:true,display:'ready',
    camera_status:'available',revision:1,dev_controls:true,camera_session:'session',
    behaviour:{status:'present',armed:true,reminder_active:false,absence_seconds:0},
    head_direction:'left',observation:{presence:'present',reason:'usable',
      head_pose:{yaw:40,pitch:0,roll:0},blendshapes:{jawOpen:0.25}}};
  const message=(next)=>sockets[0].onmessage({data:JSON.stringify(next)});
  return {node,state,message,sockets};
}
test('shows observations without a reminder',t=>{
  const {node,state,message}=setup(t);
  message(state);
  assert.equal(node('face-presence').textContent,'Present');
  assert.equal(node('head-direction').textContent,'left');
  assert.equal(node('dismiss-reminder').hidden,true);
  assert.match(node('expression-scores').textContent,/jawOpen: 0.25/);
});
test('real reminders can be dismissed while manual previews have no prompt',t=>{
  const {node,state,message,sockets}=setup(t);
  state.display='reminding';
  message(state);
  assert.equal(node('reminder-message').hidden,true);
  state.behaviour.reminder_active=true;
  message(state);
  assert.equal(node('dismiss-reminder').disabled,false);
  assert.equal(node('reminder-message').hidden,false);
  node('dismiss-reminder').onclick();
  assert.equal(JSON.parse(sockets[0].sent).type,'dismiss_reminder');
});
test('uncertain input has independent camera status',t=>{
  const {node,state,message}=setup(t);
  state.observation={presence:'unknown',reason:'low_light'};
  state.display='unavailable';
  state.behaviour.status='uncertain';
  message(state);
  assert.equal(node('face-presence').textContent,'Unknown');
  assert.equal(node('image-quality').textContent,'Low light');
  assert.match(node('detection-status').textContent,/reminders suspended/);
});

test('head direction and angles appear automatically',t=>{
  const {node,state,message}=setup(t);
  message(state);
  assert.equal(node('head-direction').textContent,'left');
  assert.match(node('head-angles').textContent,/Yaw 40°/);
  assert.match(node('head-angles').textContent,/roll 0°/);
});
