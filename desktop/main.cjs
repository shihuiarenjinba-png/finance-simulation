"use strict";
const {app,BrowserWindow,dialog,shell}=require("electron");
const path=require("node:path");
const fs=require("node:fs");
let mainWindow;
function insideApp(filePath){const root=path.resolve(__dirname,"..");const target=path.resolve(filePath);return target===root||target.startsWith(root+path.sep);}
function createWindow(){
 const entry=path.resolve(__dirname,"..","index.html");
 if(!fs.existsSync(entry))throw new Error("Packaged application entrypoint is missing: "+entry);
 mainWindow=new BrowserWindow({width:1280,height:820,minWidth:900,minHeight:640,show:false,
  autoHideMenuBar:true,backgroundColor:"#142027",
  webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,allowRunningInsecureContent:false}});
 mainWindow.webContents.setWindowOpenHandler(()=>({action:"deny"}));
 mainWindow.webContents.on("will-navigate",(event,url)=>{
  try{const u=new URL(url);if(u.protocol!=="file:"||!insideApp(require("node:url").fileURLToPath(u)))event.preventDefault();}
  catch{event.preventDefault();}
 });
 mainWindow.once("ready-to-show",()=>mainWindow.show());
 mainWindow.on("closed",()=>{mainWindow=null;});
 mainWindow.loadFile(entry);
}
app.whenReady().then(createWindow).catch(async error=>{await dialog.showMessageBox({type:"error",title:"Application startup failed",message:"The packaged app could not start.",detail:String(error)});app.quit();});
app.on("activate",()=>{if(BrowserWindow.getAllWindows().length===0)createWindow();});
app.on("window-all-closed",()=>{if(process.platform!=="darwin")app.quit();});
