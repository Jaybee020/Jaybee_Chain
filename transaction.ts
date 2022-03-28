import { SHA256 } from "crypto-js"
import * as ecdsa from "elliptic"
import * as _ from 'lodash'

export const ec = new ecdsa.ec('secp256k1');//specifying the elliptic curve to use


const COINBASE_AMOUNT: number = 50;//first transaction in the block and is the reward for mining that block

function getCoinbaseTransaction(address:string,blockheight:number){
    const txIn=new TxIn("",blockheight,"")
    const txOut=new TxOut(address,COINBASE_AMOUNT)
    const Tx=new Transactions([txIn],[txOut])
    return Tx
}

function validateCoinbaseTransaction(transaction:Transactions,blockheight:number){
    if(transaction==null){
        console.log('the first transaction in the block must be coinbase transaction');
        return false;
    }
    if(transaction.generateTransactionId()!==transaction.id){
        console.log('invalid coinbase tx id: ' + transaction.id);
        return false;
    }
    if(transaction.txIns.length !==1){
        console.log('one txIn must be specified in the coinbase transaction');
        return;
    }
    if(transaction.txIns[0].txOutIndex!==blockheight){
        console.log('the txIn index in coinbase tx must be the block height');
        return false;
    }
    if (transaction.txOuts.length !== 1) {
        console.log('invalid number of txOuts in coinbase transaction');
        return false;
    }
    if (transaction.txOuts[0].amount != COINBASE_AMOUNT) {
        console.log('invalid coinbase amount in coinbase transaction');
        return false;
    }
    return true;
}


class TxOut{
    constructor(
        public address:string,
        public amount:number
    ){
    }
}

class TxIn {
    constructor(
        public txOutId: string,
        public txOutIndex: number,
        public signature: string,
    ){
    }


    //a valid txIn is one that corresponds to an unspent TxOut  and  the signature matches the txout address 
    validateTxIn(UnspentTxOuts:UnspentTxOut[]):boolean{
        const referencedUTxO=UnspentTxOuts.find((UTxO)=> this.txOutId===UTxO.txOutId && this.txOutIndex===UTxO.txOutIndex)
        if (!referencedUTxO) {
            console.log('referenced txOut not found: ' + JSON.stringify(this));
            return false;
        }
        const referencedAddress=referencedUTxO.address
        const publickey=ec.keyFromPublic(referencedAddress,"hex")
        return publickey.verify(this.txOutId,this.signature)

    }
}



class UnspentTxOut{
    constructor(public readonly txOutId: string, public readonly txOutIndex: number,public readonly address: string,public readonly amount: number) {
        this.txOutId = txOutId;
        this.txOutIndex = txOutIndex;
        this.address = address;
        this.amount = amount;
    }
}

class Transactions{
        public id: string
        public txIns: TxIn[]
        public txOuts: TxOut[]
    constructor(txIns:TxIn[],txOuts:TxOut[]
    ){
        this.id=this.generateTransactionId()
        this.txIns=txIns
        this.txOuts=txOuts

    }


    generateTransactionId():string{
        const txinContent=this.txIns
        .map((txin:TxIn)=>txin.txOutId+txin.txOutIndex.toString())
        .reduce((a,b)=>a+b,"")

        const txOutContent: string = this.txOuts
        .map((txOut: TxOut) => txOut.address + txOut.amount.toString())
        .reduce((a, b) => a + b, '');

        return SHA256(txinContent+txOutContent).toString()

    }

    signTxIn(txIn:TxIn,private_key:string,UnspentTxOuts:UnspentTxOut[]){
        const dataToSign=this.id
       
        const referencedUTxO=findUnspentTxOut(txIn.txOutId,txIn.txOutIndex,UnspentTxOuts)
        if(referencedUTxO){
            const referencedAddress=referencedUTxO.address
            if (getPublicKey(private_key)!==referencedAddress){
                console.log('trying to sign an input with private key that does not match the address that is referenced in txIn');
            throw Error();
            }
        const key=ec.keyFromPrivate(private_key)
        const signedData=ec.sign(dataToSign,key)
        txIn.signature=toHexString(signedData.toDER())
        return txIn.signature==toHexString(signedData.toDER())
        }else{
            console.log("Could not find an unspent UTXO")
        }
    }

    //checking if a transaction is valid
    isValidTransactionStructure(){
    if (typeof this.id !== 'string') {
        console.log('transactionId missing');
        return false;
    }
    if (!(this.txIns instanceof Array)) {
        console.log('invalid txIns type in transaction');
        return false;
    }
    if (!this.txIns
            .map(isValidTxInStructure)
            .reduce((a:boolean, b:boolean) => (a && b), true)) {
        return false;
    }

    if (!(this.txOuts instanceof Array)) {
        console.log('invalid txIns type in transaction');
        return false;
    }

    if (!this.txOuts
            .map(isValidTxOutStructure)
            .reduce((a:boolean, b:boolean) => (a && b), true)) {
        return false;
    }
    return true;};



    hasDuplicatetxIn():boolean{
        const groups =_.countBy(this.txIns,(txIn)=>txIn.txOutId+txIn.txOutId)
        let x=_.map(groups,(value,key)=>{
            if(value>1){
                console.log('duplicate txIn: ' + key);
                return true
            }else{
                return false
            }
        })
        return _.includes(x,true)

        
    }

    validateTransaction(UnspentTxOuts:UnspentTxOut[]):boolean{
        if(this.generateTransactionId()!==this.id){
            console.log("invalid transaction id")
            return false
        }

        //checks each txIn to know if it is valid
        const validTxins=this.txIns.map((txIn)=>txIn.validateTxIn(UnspentTxOuts)).reduce((a,b)=>a&&b,true)//validating each txIn
        if(!validTxins){
            console.log("Some transactions are not valid")
            return false
        }
        const totalTxInamount=this.txIns.map((txIn)=>findUnspentTxOut(txIn.txOutId,txIn.txOutIndex,UnspentTxOuts)?.amount)
                                        .reduce((a,b)=>{
                                            if(a && b){
                                                return a+b
                                            }
        })

        const totalTxOutamount=this.txOuts.map((txOut)=>txOut.amount).reduce((a,b)=>a+b)
        if (totalTxOutamount !== totalTxInamount) {
            console.log('totalTxOutValues !== totalTxInValues in tx: ' + this.id);
            return false;
        }
        return true
    }
}



//find a UTXO in the list of unspent of unspent transactions
function findUnspentTxOut(transactionid:string,index:number,UnspentTxOuts:UnspentTxOut[]){
    return UnspentTxOuts.find((UTxO)=>{
        UTxO.txOutId==transactionid&&UTxO.txOutIndex==index
    })
}

//updating the unspent transaction output for every new transaction
function updateUnspendTxOut(newTransactions:Transactions[],UnspentTxOuts:UnspentTxOut[]):UnspentTxOut[]{
    //changes an array of new transactions to an array of new unspent transactions and concatenates them 
    const newUnspentTxOut:UnspentTxOut[]=newTransactions.map((newtransaction)=>{
        return newtransaction.txOuts.map((txout,index)=> new UnspentTxOut(newtransaction.id,index,txout.address,txout.amount))
    }).reduce((a,b)=>a.concat(b),[])

    const consumedTxOut=newTransactions.map((newtransaction)=>newtransaction.txIns)//reduces to an array of txins
                                       .reduce((a,b)=>a.concat(b),[])//concatenates them to one list
                                       .map((txin:TxIn)=>new UnspentTxOut(txin.txOutId,txin.txOutIndex,"",0))

    //finding the remaining unspenttxout by filtering the array for the ones that are already consumed and concatenating it with the new ones
    const remainingUnspentTxOut=UnspentTxOuts.filter((UTxO)=>!findUnspentTxOut(UTxO.txOutId,UTxO.txOutIndex,consumedTxOut))
                                             .concat(newUnspentTxOut)

    return remainingUnspentTxOut
}




const isValidTxInStructure = (txIn: TxIn): boolean => {
    if (txIn == null) {
        console.log('txIn is null');
        return false;
    } else if (typeof txIn.signature !== 'string') {
        console.log('invalid signature type in txIn');
        return false;
    } else if (typeof txIn.txOutId !== 'string') {
        console.log('invalid txOutId type in txIn');
        return false;
    } else if (typeof  txIn.txOutIndex !== 'number') {
        console.log('invalid txOutIndex type in txIn');
        return false;
    } else {
        return true;
    }
};

const isValidTxOutStructure = (txOut: TxOut): boolean => {
    if (txOut == null) {
        console.log('txOut is null');
        return false;
    } else if (typeof txOut.address !== 'string') {
        console.log('invalid address type in txOut');
        return false;
    } else if (!isValidAddress(txOut.address)) {
        console.log('invalid TxOut address');
        return false;
    } else if (typeof txOut.amount !== 'number') {
        console.log('invalid amount type in txOut');
        return false;
    } else {
        return true;
    }
};


function getPublicKey(privatekey:string):string{
    return ec.keyFromPrivate(privatekey, 'hex').getPublic().encode('hex',true);
}

function toHexString(byteArray:any[]):string{
    return Array.from(byteArray,(byte)=>{
        return ('0'+(byte & 0xFF).toString(16)).slice(-2)//creating a new array from each byte in the byte array after changing them to hexadecimal 
    }).join('')
}

//valid address is a valid ecdsa public key in the 04 + X-coordinate + Y-coordinate format
function isValidAddress(address: string): boolean{
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

//validate the transaction in each block
function validateBlockTransactions(transactions:Transactions[],UnspentTxOuts:UnspentTxOut[],blockheight:number):boolean{
    const coinbaseTx=transactions[0]
    if(validateCoinbaseTransaction(coinbaseTx,blockheight)){
        console.log('invalid coinbase transaction: ' + JSON.stringify(coinbaseTx));
        return false;
    }

    const duplicate_exist=transactions.map((tx)=>tx.hasDuplicatetxIn()).reduce((a,b)=>a&&b,true)
    if(duplicate_exist){
        return false
    }

    const normalTransactions: Transactions[] = transactions.slice(1);
    return normalTransactions.map((tx) =>tx.validateTransaction(UnspentTxOuts)).reduce((a,b)=>a&&b,true);
}

//to process every tansaction and update the unspent txout
function processTransactions(transactions:Transactions[],UnspentTxOuts:UnspentTxOut[],blockheight:number){
    const validTransactions:boolean=transactions.map((tx)=>tx.isValidTransactionStructure()).reduce((a,b)=>a&&b,true)
    if(!validTransactions){
        return false
    }
    if(!validateBlockTransactions(transactions,UnspentTxOuts,blockheight)){
        return false
    }

    return updateUnspendTxOut(transactions,UnspentTxOuts)
}

export {
    processTransactions, UnspentTxOut, TxIn, TxOut, getCoinbaseTransaction, getPublicKey,Transactions
}