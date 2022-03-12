import sha256 from "crypto-js/sha256"
import  WordArray from "crypto-js/lib-typedarrays"
import     {broadcastLatest}    from "./p2p"
import BigNumber from "bignumber.js"
import { processTransactions, Transactions, UnspentTxOut } from "./transaction"

interface Blocktype{
    hash:WordArray,
    height:number,
    body:Transactions[],
    timestamp:Date,
    previousblockhash:WordArray|null,
    difficulty:number,
    minterBalance:number,
    minterAddress:string,
    calculatehash:()=>WordArray,

}



function getPublicAddress(){
    return "3def"
}

function getBalance(){
    return 40
}

const MINT_WITHOUGHT_BALANCE_HEIGHT=5
//time interval between generation of blocks in seconds
const BLOCK_GENERATION_INTERVAL: number = 10;

//how much difference before diffculty is adjusted in blocks
const DIFFICULTY_ADJUSTMENT_INTERVAL: number = 10;

var UnspentTxOuts:UnspentTxOut[]=[]

class Block implements Blocktype{
    hash: WordArray
    previousblockhash: WordArray|null
    timestamp: Date
    height: number
    difficulty: number
    minterBalance: number
    minterAddress: string
    constructor(
      public body: Transactions[],
      minterBalance:number,
      minterAddress:string
    ) {
        this.hash=sha256("Created Genesis block")
        this.previousblockhash=null
        this.timestamp=new Date()
        this.height=0
        this.difficulty=0,
        this.minterAddress=minterAddress,
        this.minterBalance=minterBalance
    }

    calculatehash(){
        const hash=sha256(String(this.height)+this.body+this.timestamp.toString()+this.previousblockhash?.toString()+String(this.difficulty)+String(this.minterBalance)+this.minterAddress)
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
        return new Block([],getBalance(),getPublicAddress())
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
        newBlock.difficulty=this.getDifficulty()
        if(isValidBlockStructure(newBlock)){
        const foundBlock=this.findBlock(newBlock)//finding valid block that satisfies the PoS algorithm and add it to blockchain
        if(this.isValidTimestamp(newBlock)){
            const newUnspentTxOut=processTransactions(newBlock.body,UnspentTxOuts,newBlock.height)
            if(newUnspentTxOut){
            UnspentTxOuts=newUnspentTxOut
            this.chain.push(foundBlock)
            }
        }
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
            if(!isValidBlockStructure(that_block)){
                return false
            }
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
            broadcastLatest(this)
        }else{
            console.log("Received blockchain is invalid")
        }
    }
    // find a block that satisfies the stake algorithm
    findBlock(block:Blocktype):Blocktype{
        let pastTimestamp:number=0
        while(true){
            let timestamp= Date.now()
            if(pastTimestamp!==timestamp){
                if(this.isStakingValid(block)){
                    block.timestamp=new Date(timestamp)//updating the timestamp for the block after finding valid timestamp for it 
                    return block
                }
                pastTimestamp=timestamp
            }
        }
    }

    //getting diffculty
    getDifficulty():number{
        const latestblock=this.getLatestBlock()
        if(latestblock.height % DIFFICULTY_ADJUSTMENT_INTERVAL==0 && latestblock.height!=0){
            return this.getAdjustedDifficulty()
        }else{
            return latestblock.difficulty
        }
    }


    getAdjustedDifficulty():number{
        const prevAdjustedBlock:Blocktype=this.chain[this.chain.length-DIFFICULTY_ADJUSTMENT_INTERVAL]
        const timeExpected=BLOCK_GENERATION_INTERVAL*DIFFICULTY_ADJUSTMENT_INTERVAL
        const timeTaken=this.getLatestBlock().timestamp.getUTCMilliseconds()-prevAdjustedBlock.timestamp.getUTCMilliseconds()
        if(timeTaken<timeExpected/2){
            return prevAdjustedBlock.difficulty+1
        }else if(timeTaken>timeExpected/2){
            return prevAdjustedBlock.difficulty-1
        }else{
            return prevAdjustedBlock.difficulty
        }
    }


     // Proof of stake function we would love to implement SHA256(prevhash + address + timestamp) <= 2^256 * balance / diff
    //The more your balance the chance it is you are most likely to solve the cryptographic puzzle,difficulty is dynamically calculated,higher diffculty is the smaller right hand side becomes
    isStakingValid(block:Blocktype){

        block.difficulty=block.difficulty+1

        // Allow minting for blocks below a certain block height
        if(block.height<=MINT_WITHOUGHT_BALANCE_HEIGHT){
            block.minterBalance=block.minterBalance+1
        }

        const balanceoverdifficulty=new BigNumber(2).exponentiatedBy(256).multipliedBy(getBalance()).dividedBy(this.getDifficulty())
        const stakingHash=sha256(block.previousblockhash+getPublicAddress()+block.timestamp.toString())
        const decimalStakinghash=new BigNumber(stakingHash.toString(),16)
        const difference=decimalStakinghash.minus(balanceoverdifficulty)

        return difference.toNumber() <=0
    }

    //making sure the timestamp in the block is valid 
    isValidTimestamp(newBlock:Blocktype):Boolean{
        const previousBlock=this.getLatestBlock()
        return (previousBlock.timestamp.getUTCMilliseconds()-60<newBlock.timestamp.getUTCMilliseconds())&& (newBlock.timestamp.getUTCMilliseconds()-60<Date.now())
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

