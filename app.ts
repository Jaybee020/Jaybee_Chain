import express from "express";
import { json } from "body-parser";
import { Request,Response } from "express";
import { Blockchain,Block, getAccountBalance} from "./main";
import {connecttoPeers,getSockets,initP2Pserver} from "./p2p"
import { getPublicfromWallet, initWallet } from "./wallet";
const app=express()
app.use(json())

initWallet()


const Jaybee_chain=new Blockchain([])
Jaybee_chain.creategenesisblock()

app.get("/blocks",(req:Request,res:Response)=>{
    res.status(200).send({
        chain:Jaybee_chain.chain
    }
    )
})

app.post("/mineblock",(req:Request,res:Response)=>{
    if (req.body.address == null || req.body.amount==null) {
        res.send('data parameter is missing');
        return;
    }
    const TxBody=Jaybee_chain.generateBlockData(req.body.address,req.body.amount)
    const newBlock=new Block(getAccountBalance(),getPublicfromWallet(),TxBody)
    Jaybee_chain.addBlock(newBlock)
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
