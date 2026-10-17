import {createContext,useContext} from 'react'
import type {CustomerAuthState,CustomerIdentity,CustomerProfile} from './customer-account-types'
export type CustomerAccountContextValue={
  enabled:boolean;ready:boolean;state:CustomerAuthState;openSignIn:()=>void;refresh:()=>Promise<void>
  saveProfile:(profile:CustomerProfile)=>Promise<CustomerIdentity>;signOut:()=>Promise<void>
}
export const disabledCustomerAccount:CustomerAccountContextValue={enabled:false,ready:false,state:{status:'guest'},openSignIn(){},async refresh(){},async saveProfile(){throw Error('CUSTOMER_ACCOUNT_DISABLED')},async signOut(){}}
export const CustomerAccountContext=createContext<CustomerAccountContextValue>(disabledCustomerAccount)
export function useCustomerAccount(){return useContext(CustomerAccountContext)}
