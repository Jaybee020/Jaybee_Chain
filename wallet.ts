import {writeFileSync,existsSync,readFileSync} from "fs";
import { ec, TxIn, UnspentTxOut,Transactions, TxOut } from "./transaction";

const location="wallet/private_key"

function generatePrivatekey():string{
    const keyPair=ec.genKeyPair()
    const privKey=keyPair.getPrivate()
    return privKey.toString(16)
}

function initWallet(){
    if(existsSync(location)){
        return ;
    }
    const newPrivKey=generatePrivatekey()
    writeFileSync(location,newPrivKey)
    console.log('new Wallet with private key created')
}


function getPrivatefromWallet():string{
    const privBuffer=readFileSync(location,"utf-8")
    return privBuffer.toString()
}


function getPublicfromWallet():string{
    const privBuffer=getPrivatefromWallet()
    const privKey=ec.keyFromPrivate(privBuffer)
    return privKey.getPublic().encode("hex",true)
}


function getBalance(address:string,UnspentTxOuts:UnspentTxOut[]):number{
    return UnspentTxOuts.filter((UTxO:UnspentTxOut)=>UTxO.address===address).map((UTxO:UnspentTxOut)=>UTxO.amount).reduce((a,b)=>a+b,0)
}


function findTxOutforAmount(amount:number,myUnspentTxOuts:UnspentTxOut[]){
    let currentAmount=0
    const includedUnspentTxOuts = [];
    for(const myUnspentTxOut of myUnspentTxOuts){
        includedUnspentTxOuts.push(myUnspentTxOut)
        currentAmount+=myUnspentTxOut.amount
        if(currentAmount>=amount){
            const leftbalance=currentAmount-amount
            return {includedUnspentTxOuts,leftbalance}
        }
        throw Error('not enough coins to fund transaction')
    }
}


function UnspentTxOut_to_TxIn(myUnspentTxOut:UnspentTxOut){
    let txIn=new TxIn(myUnspentTxOut.txOutId,myUnspentTxOut.txOutIndex,"")
    return txIn
}

function createTransaction(amount:number,receiverAddr:string,privatekey:string,UnspentTxOuts:UnspentTxOut[]){
    const myAddress=getPublicfromWallet()
    const myUnspentTxOuts=UnspentTxOuts.filter((UTxO:UnspentTxOut)=>UTxO.address===myAddress)
    const txInfo = findTxOutforAmount(amount, myUnspentTxOuts);
    if(txInfo){
    const {includedUnspentTxOuts,leftbalance}=txInfo
    const unSignedTxin=includedUnspentTxOuts.map(UnspentTxOut_to_TxIn);
    const txOuts=createTxout(receiverAddr,myAddress,leftbalance,amount)
    const tx=new Transactions(unSignedTxin,txOuts)
    const success= tx.txIns.map((txIn)=>tx.signTxIn(txIn,privatekey,UnspentTxOuts)).reduce((a,b)=>a&&b,true)
    if(success){
        return tx
    }
    }else{
        throw Error("Couldn't create transaction")
    }
}

function createTxout(receiverAddr:string,myAddress:string,leftbalance:number,amount:number){
    const txOut=new TxOut(receiverAddr,amount)
    if(leftbalance==0){
        return [txOut]
    }else{
        const recreditTx=new TxOut(myAddress,amount)
        return [txOut,recreditTx]
    }
}

export {createTransaction,getPublicfromWallet,getPrivatefromWallet,generatePrivatekey,getBalance,initWallet}