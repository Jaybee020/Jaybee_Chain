import sha256 from "crypto-js/sha256"
import  WordArray from "crypto-js/lib-typedarrays"
import     {broadcastLatest}    from "./p2p"

interface Blocktype{
    hash:WordArray,
    height:number,
    body:string,
    timestamp:Date,
    previousblockhash:WordArray|null
    calculatehash:()=>WordArray

}


class Block implements Blocktype{
    hash: WordArray
    previousblockhash: WordArray|null
    timestamp: Date
    height: number
    constructor(
      public body: string,
    ) {
        this.hash=sha256("genesis block")
        this.previousblockhash=null
        this.timestamp=new Date()
        this.height=0
    }

    calculatehash(){
        const hash=sha256(String(this.height)+this.body+this.timestamp.toString()+this.previousblockhash?.toString())
        return hash
    }
  }


class Blockchain{
    constructor(
        public chain:Blocktype[],        
    ){
        //adds first genesis block
        this.addBlock(this.creategenesisblock())
        
    }
    creategenesisblock():Blocktype{
        return new Block("Ganesis block")
    }
    addBlock(newBlock:Blocktype){
        //setting new block previousblockhash field if it is not the genesis block
        if(this.chain.length>0){
            newBlock.previousblockhash=this.getLatestBlock().hash
        }
        //add new block to blockchain
        newBlock.height=this.chain.length
        newBlock.timestamp=new Date()
        newBlock.hash= newBlock.calculatehash()
        if(isValidBlockStructure(newBlock)){
        this.chain.push(newBlock)
        broadcastLatest(this)//send chain over websocket
        }
    }

    getBlock(blockheight:number):Blocktype{
        return this.chain[blockheight]
    }
    
    getLatestBlock():Blocktype{
        return this.chain[this.chain.length-1]
    }


    validateblock(blockheight:number):boolean{
        const that_block=this.getBlock(blockheight)
        if(blockheight==0){
            return that_block.hash.toString()==that_block.calculatehash().toString()
        }else{
            const prev_block=this.getBlock(blockheight-1)
            if(that_block.height!=prev_block.height+1){
                return false
            }else if(that_block.previousblockhash!=prev_block.hash){
                return false
            }else if(that_block.hash.toString()!==that_block.calculatehash().toString()){
                return false
            }
            return true
        }
    }
    validatechain():Boolean{
        var isValid=true
        for(let i=0;i++;i<this.chain.length){
            const block_valid=this.validateblock(i)
            isValid=isValid&&block_valid
        }
        return true
    }

    replacechain(newBlocks:Blockchain):void{
        if(newBlocks.validatechain()&&newBlocks.chain.length>this.chain.length){
            console.log('Received blockchain is valid. Replacing current blockchain with received blockchain');
            this.chain= newBlocks.chain;
            // broadcast()
        }else{
            console.log("Received blockchain is invalid")
        }
    }

}

const isValidBlockStructure = (block: Blocktype): boolean => {
    return typeof block.height === 'number'
        && typeof block.hash === 'object'
        && typeof block.previousblockhash === 'object'
        && typeof block.timestamp === 'object'
        && typeof block.body === 'string';
};
  
export {Block,Blockchain,isValidBlockStructure,Blocktype}

