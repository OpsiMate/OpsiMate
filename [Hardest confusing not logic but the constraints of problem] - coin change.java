public class Main
{
    public static int myfun(int []arr, int i,int n,int d){
        if(d==0){
            return 0;
        }
        if(d<0 || i>=n){
            return 1000000000;
        }
        
        int take = 1+myfun(arr,i,n,d-arr[i]);
        
        
        int nottake = myfun(arr,i+1,n,d);
        
        return Math.min(take,nottake);
    }
    
	public static void main(String[] args) {
	    int d=2;
	    int []arr={1,1,2147483647};
	    int n=arr.length;
	   
	    System.out.println(myfun(arr,0,n,d));
	}
}


