export type Category={id:string;userId?:string|null;code:string;name:string;type:"INCOME"|"EXPENSE";icon:string;color:string;status:boolean};
export type Transaction={id:string;categoryId:string;type:"INCOME"|"EXPENSE";description:string;value:string|number;date:string;paymentMethod:string;category:Pick<Category,"id"|"name"|"icon"|"color">};
export type Summary={totalIncome:number;totalExpense:number;netBalance:number};
