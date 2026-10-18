import {createContext,useContext} from 'react'
import type {CustomerAuthState,CustomerIdentity,CustomerProfile,CustomerCheckoutDraft,CustomerOrdersStatus,CustomerOrdersPage,CustomerOrderDetail} from './customer-account-types'
export type CustomerAccountContextValue={
  enabled:boolean;ordersStatus:CustomerOrdersStatus;state:CustomerAuthState;openSignIn:(event?:{currentTarget:HTMLElement})=>void;refresh:()=>Promise<void>
  getOrders:(options?:{cursor?:string})=>Promise<CustomerOrdersPage>;getOrder:(id:string)=>Promise<CustomerOrderDetail>
  saveProfile:(profile:CustomerProfile)=>Promise<CustomerIdentity>;signOut:()=>Promise<void>
  registerCheckout:(capture:()=>CustomerCheckoutDraft,onGuest?:()=>void)=>()=>void
  invalidateSession:()=>void
}
export const disabledCustomerAccount:CustomerAccountContextValue={enabled:false,ordersStatus:'idle',state:{status:'guest'},openSignIn(){},async refresh(){},async getOrders(){throw Error('CUSTOMER_ACCOUNT_DISABLED')},async getOrder(){throw Error('CUSTOMER_ACCOUNT_DISABLED')},async saveProfile(){throw Error('CUSTOMER_ACCOUNT_DISABLED')},async signOut(){},registerCheckout(){return ()=>{}},invalidateSession(){}}
export const CustomerAccountContext=createContext<CustomerAccountContextValue>(disabledCustomerAccount)
export function useCustomerAccount(){return useContext(CustomerAccountContext)}
