 import  Websocket from "ws"
 import { Server } from "ws"
 import { Blockchain,Block,isValidBlockStructure,Blocktype } from "./main";

//list of all connections present 
const sockets:Websocket[]=[]

//all the types of messsagetype
enum messagetype {
    getLatestblock=0,
    getAllBlocks=1,
    responsechain=2
}
//Websocket message events constructor
class Message{
    constructor(
        public type:messagetype,
        public data:any){}
    }

//to convert json string to object of type T
function JSONtoOBJ<T>(data:string):T|null{
    try {
        return JSON.parse(data)
    } catch (error) {
        console.log(error)
        return null
    }
}


function initP2Pserver(port:number,chain:Blockchain):void{
    const server:Server=new Websocket.Server({port:port})
    server.on("connection",(socket:Websocket)=>{
        console.log('Connected to the websocket')
        initializeconnection(socket,chain)
    })

}

//what to do when you connect to the websocket port
//push node connection to list of present connection
function initializeconnection(ws:Websocket,chain:Blockchain){
    sockets.push(ws)
    MessageHandler(ws,chain)
    errorHandler(ws)
    ws.send(JSON.stringify({'type': messagetype.getLatestblock, 'data': null}))
}

function errorHandler(ws:Websocket){
    const close=()=>{console.log("Couldnt connect")}
    ws.on("close",close)
    ws.on("error",close)
}

function MessageHandler(ws:Websocket,chain:Blockchain){
    ws.on("message",(data:string)=>{
        const message=JSONtoOBJ<Message>(data)
        if(message==null){
            console.log("Couldnt parse data")
        }else{
            //what to do depending on the message type it got
            switch(message.type){
                //if the message type was a get latestblock type send an object containing that via websocket
                case messagetype.getLatestblock:
                    ws.send(JSON.stringify({
                        'type':messagetype.responsechain,//send a message of type gotten results from chain
                        'data':[chain.getLatestBlock()]
                    }))
                    break
                case messagetype.getAllBlocks:
                    ws.send(JSON.stringify({
                        'type':messagetype.responsechain,
                        'data':chain.chain
                    }))
                    break
                case messagetype.responsechain://message type is that it has gotten response from blockchain
                    const received_blocks=JSONtoOBJ<Blocktype[]>(message.data)
                    if (received_blocks === null) {
                        console.log('invalid blocks received:');
                        console.log(message.data)
                        break;
                    }else{
                        handlechainresponse(received_blocks,chain)
                    }
            }
        }

    })
}

const broadcast = (message: Message): void => sockets.forEach((socket)=>{socket.send(JSON.stringify(message))} );

//function to call when a new block is created it should send the latest block created
const broadcastLatest = (chain:Blockchain): void => {
    broadcast({
        'type':messagetype.responsechain,//send a message of type gotten results from chain
        'data':[chain.getLatestBlock()]
    });
};

//function to handle response on our events
function handlechainresponse(received_blocks:Blocktype[],chain:Blockchain){
    if (received_blocks.length === 0) {
        console.log('received block chain size of 0');
        return;
    }
    const latestBlockReceived: Block = received_blocks[received_blocks.length - 1];//gets the latest block received
    if (!isValidBlockStructure(latestBlockReceived)) {
        console.log('block structuture not valid');
        return;
    }
    const latestblockinchain=chain.getLatestBlock()//gets latest block in chain
    //validates the new block generated
    if(latestBlockReceived.height>latestblockinchain.height){
        console.log("We have received a new block of index"+ String(latestBlockReceived.height))
        if(latestblockinchain.hash.toString()==latestBlockReceived.hash.toString()){
            chain.addBlock(latestBlockReceived)//add the block to their version of the blockchain
            broadcast({
                'type':messagetype.responsechain,
                'data':[chain.getLatestBlock()]
            })
        }else if(received_blocks.length==1){//if it received a single block and that single block prev hash is not equal to that block hash(for genesis hash wheree there is no previous hash for upper if statement)
            broadcast({
                type:messagetype.getAllBlocks,
                data:null
            })//request for all chain from blockchain and 
        }else{
            //received blockchain is longer than current blockchain
            chain.replacechain(new Blockchain(received_blocks))
        }
    }else{
        console.log("received invalid blockchain")
    }
    
}


function connecttoPeers(newPeer:string,chain:Blockchain){
    const ws:Websocket=new Websocket(newPeer)
    ws.on('open', () => {
        initializeconnection(ws,chain);
    });
    ws.on('error', () => {
        console.log('connection failed');
    });
}
const getSockets = () => sockets;
export {connecttoPeers,broadcast,getSockets,initP2Pserver,broadcastLatest}