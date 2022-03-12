import express from "express";
import { json } from "body-parser";
import { Request,Response } from "express";
import { Blockchain,Block} from "./main";
import {connecttoPeers,getSockets,initP2Pserver} from "./p2p"
const app=express()
app.use(json())


const Jaybee_chain=new Blockchain([])
Jaybee_chain.creategenesisblock()

app.get("/blocks",(req:Request,res:Response)=>{
    res.status(200).send({
        chain:Jaybee_chain.chain
    }
    )
})

app.post("/mineblock",(req:Request,res:Response)=>{
    Jaybee_chain.addBlock(new Block(req.body.data,0,""))
    res.status(200).send({
        chain:Jaybee_chain.chain
    }
    )
})

app.get('/peers',(req:Request,res:Response)=>{
    res.send(getSockets().map(( s: any ) => s._socket.remoteAddress + ':' + s._socket.remotePort));
})

app.post("/addpeer",(req:Request,res:Response)=>{
    connecttoPeers(req.body.peer,Jaybee_chain)
    res.send()
})




app.listen(8000,function(){
    console.log("Listening on port 8000")
})
initP2Pserver(3000,Jaybee_chain)
