import sha256 from "crypto-js/sha256"
import  WordArray from "crypto-js/lib-typedarrays"
import     {broadcastLatest}    from "./p2p"
import BigNumber from "bignumber.js"
import { processTransactions, Transactions, UnspentTxOut,getCoinbaseTransaction } from "./transaction"
import {createTransaction, getBalance, getPrivatefromWallet, getPublicfromWallet} from './wallet'

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
    isStakingValid:(chain:Blockchain)=>boolean

}



function getPublicAddress(){
    return "3def"
}



const MINT_WITHOUGHT_BALANCE_HEIGHT=5
//time interval between generation of blocks in seconds
const BLOCK_GENERATION_INTERVAL: number = 10;


//how much difference before diffculty is adjusted in blocks
const DIFFICULTY_ADJUSTMENT_INTERVAL: number = 10;

function getAccountBalance(){
    return getBalance(getPublicfromWallet(),UnspentTxOuts)
}

var UnspentTxOuts:UnspentTxOut[]=[]



class Block implements Blocktype{
    hash: WordArray
    previousblockhash: WordArray|null
    timestamp: Date
    height: number
    difficulty: number
    minterBalance: number
    minterAddress: string
    body: Transactions[]
    constructor(
      minterBalance:number,
      minterAddress:string,
      body:Transactions[]
    ) {
        this.hash=sha256("Created Genesis block")
        this.previousblockhash=null
        this.timestamp=new Date()
        this.height=0
        this.difficulty=0,
        this.minterAddress=minterAddress,
        this.minterBalance=minterBalance
        this.body=body
    }

    calculatehash(){
        const hash=sha256(String(this.height)+this.body+this.timestamp.toString()+this.previousblockhash?.toString()+String(this.difficulty)+String(this.minterBalance)+this.minterAddress)
        return hash
    }

    // Proof of stake function we would love to implement SHA256(prevhash + address + timestamp) <= 2^256 * balance / diff
    //The more your balance the chance it is you are most likely to solve the cryptographic puzzle,difficulty is dynamically calculated,higher diffculty is the smaller right hand side becomes
    isStakingValid(chain:Blockchain){

        this.difficulty=this.difficulty+1

        // Allow minting for blocks below a certain block height
        if(this.height<=MINT_WITHOUGHT_BALANCE_HEIGHT){
            this.minterBalance=this.minterBalance+1
        }
        const balanceoverdifficulty=new BigNumber(2).exponentiatedBy(256).multipliedBy(getAccountBalance()).dividedBy(chain.getDifficulty())
        const stakingHash=sha256(this.previousblockhash+getPublicAddress()+this.timestamp.toString())
        const decimalStakinghash=new BigNumber(stakingHash.toString(),16)
        const difference=decimalStakinghash.minus(balanceoverdifficulty)
        return difference.toNumber() <=0
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
        return new Block(getAccountBalance(),getPublicfromWallet(),[])
    }
    addBlock(newBlock:Blocktype){
        //setting new block previousblockhash field if it is not the genesis block
        if(this.chain.length>0){
            newBlock.previousblockhash=this.getLatestBlock().hash
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
            }
    }else{
        this.chain.push(newBlock )
    }
        
        broadcastLatest(this)//send chain over websocket
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
            }else if(that_block.isStakingValid(this)){

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


    //changed from comapring length to comparing difficulty`
    replacechain(newBlocks:Blockchain):void{
        if(newBlocks.validatechain()&&newBlocks.getAccumulatedDifficulty()>this.getAccumulatedDifficulty()){
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
                if(block.isStakingValid(this)){
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


    generateBlockData(receiverAddress: string, amount: number):Transactions[]{
        if (!isValidAddress(receiverAddress)) {
            throw Error('invalid address');
        }
        if (typeof amount !== 'number') {
            throw Error('invalid amount');
        }
        const coinbaseTx: Transactions = getCoinbaseTransaction(getPublicfromWallet(), this.getLatestBlock().height + 1);
        const tx = createTransaction( amount,receiverAddress,getPrivatefromWallet(), UnspentTxOuts);
        if(tx?.isValidTransactionStructure()){
            const blockData: Transactions[] = [coinbaseTx, tx];
            return blockData
        }else{
            throw Error("An error occured")
        }
        
    };

    getAccumulatedDifficulty():number{
        return this.chain.map((block:Block)=>block.difficulty)
                        .map((diffuculty:number)=>Math.pow(2,diffuculty))
                        .reduce((a,b)=>a+b)
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

// valid address is a valid ecdsa public key in the 04 + X-coordinate + Y-coordinate format
const isValidAddress = (address: string): boolean => {
    if (address.length !== 130) {
        console.log('invalid public key length');
        return false;
    } else if (address.match('^[a-fA-F0-9]+$') === null) {
        console.log('public key must contain only hex characters');
        return false;
    } else if (!address.startsWith('04')) {
        console.log('public key must start with 04');
        return false;
    }
    return true;
};
  
export {Block,Blockchain,isValidBlockStructure,Blocktype,getAccountBalance}

