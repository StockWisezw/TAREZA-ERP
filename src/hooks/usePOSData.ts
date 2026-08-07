import { useState, useEffect } from 'react';
import { Product, Customer } from '../store/posStore';
import { 
  getProducts as getLocalProducts, 
  saveProducts as saveLocalProducts,
  getCategories as getLocalCategories,
  saveCategories as saveLocalCategories,
  getCustomers as getLocalCustomers,
  saveCustomers as saveLocalCustomers
} from '../lib/indexedDb';
import { supabase } from '../lib/firebaseClient';

export function usePOSData(activeSession: any) {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([
    { id: 'all', name: 'All Menu' },
  ]);

  useEffect(() => {
    let unsubscribeProducts: any = null;
    let debounceTimeout: any = null;
    
    const loadData = async () => {
      try {
        setIsLoading(true);

        // Load instantly from local cache
        const localProds = await getLocalProducts();
        if (localProds && localProds.length > 0) {
          setProducts(localProds);
          setIsLoading(false);
        }
        const localCusts = await getLocalCustomers();
        if (localCusts && localCusts.length > 0) {
          setCustomers(localCusts);
        }
        const localCats = await getLocalCategories();
        if (localCats && localCats.length > 0) {
          setCategories([
            { id: 'all', name: 'All Menu' },
            ...localCats.map((c: any) => ({ id: c.id, name: c.name }))
          ]);
        }

        // Connect fetch with supabase
        const { data: userData } = await supabase.auth.getUser();
        let userBusinessId = '';
        let userBranchId = '';
        if (userData?.user) {
          const { data: bData } = await supabase.from('business_users').select('business_id, branch_id').eq('user_id', userData.user.id).limit(1).maybeSingle();
          if (bData) {
            userBusinessId = bData.business_id;
            userBranchId = activeSession?.branch_id && activeSession.branch_id !== 'offline_branch_id' ? activeSession.branch_id : bData.branch_id;
          }
        }

        let customersQuery = supabase.from('customers').select('*').order('name');
        if (userBusinessId) {
          customersQuery = customersQuery.eq('business_id', userBusinessId);
        }

        let categoriesQuery = supabase.from('categories').select('*');
        if (userBusinessId) {
          categoriesQuery = categoriesQuery.eq('business_id', userBusinessId);
        }

        const [custRes, catRes] = await Promise.all([
          customersQuery,
          categoriesQuery
        ]);
        
        const customersData = custRes.data || [];
        const catData = catRes.data || [];
        
        if (customersData.length > 0) {
          const formattedCusts = customersData.map(c => ({
            id: c.id,
            name: c.name,
            creditLimit: Number(c.credit_limit || 0),
            balance: Number(c.balance || 0)
          }));
          setCustomers(formattedCusts);
          await saveLocalCustomers(formattedCusts);
        }

        if (catData.length > 0) {
          const formattedCats = catData.map(c => ({ id: c.id, name: c.name }));
          await saveLocalCategories(formattedCats);

          setCategories([
            { id: 'all', name: 'All Menu' },
            ...catData.map(c => ({ id: c.id, name: c.name }))
          ]);
        }
        
        const refreshPOSProducts = () => {
          let productsQuery = supabase.from('products').select('*').eq('is_active', true);
          if (userBusinessId) {
            productsQuery = productsQuery.eq('business_id', userBusinessId);
          }

          let inventoryQuery = supabase.from('inventory').select('*');
          if (userBusinessId) {
            inventoryQuery = inventoryQuery.eq('business_id', userBusinessId);
          }
          if (userBranchId) {
            inventoryQuery = inventoryQuery.eq('branch_id', userBranchId);
          }

          Promise.all([
            productsQuery,
            Promise.resolve(inventoryQuery).catch(() => ({ data: [] }))
          ]).then(([pRes, iRes]) => {
             const data = pRes.data || [];
             const invData = iRes.data || [];
             if (data && data.length > 0) {
                const updatedProducts = data.map(p => {
                  const productInventory = invData.filter((i: any) => i.product_id === p.id && (!userBranchId || i.branch_id === userBranchId));
                  const totalStock = productInventory.reduce((acc: number, cur: any) => acc + (cur.quantity || 0), 0);
                  return {
                    id: p.id,
                    name: p.name || 'Unnamed',
                    barcode: p.barcode || '',
                    sku: p.sku || '',
                    retailPrice: p.retail_price || p.retailPrice || 0,
                    wholesalePrice: p.wholesale_price || p.wholesalePrice || 0,
                    costPrice: p.cost_price || 0,
                    taxClass: p.tax_class || p.taxClass || 'standard',
                    category: p.category_id || p.category || 'all',
                    imageUrl: '', 
                    stock: totalStock,
                    bundles: p.bundles || []
                  };
                });
                setProducts(updatedProducts);
                saveLocalProducts(updatedProducts);
             } else {
                setProducts([]);
                saveLocalProducts([]);
             }
          }).catch(err => {
             console.error("Failed to refresh POS products dynamically:", err);
          });
        };

        const debouncedRefreshPOSProducts = () => {
          if (debounceTimeout) {
            clearTimeout(debounceTimeout);
          }
          debounceTimeout = setTimeout(() => {
            refreshPOSProducts();
          }, 1500);
        };

        const channel = supabase.channel('public:pos_sync')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, debouncedRefreshPOSProducts)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, debouncedRefreshPOSProducts)
          .subscribe();
          
        unsubscribeProducts = () => {
           supabase.removeChannel(channel);
           if (debounceTimeout) {
             clearTimeout(debounceTimeout);
           }
        };

        let initProductsQuery = supabase.from('products').select('*').eq('is_active', true);
        if (userBusinessId) {
          initProductsQuery = initProductsQuery.eq('business_id', userBusinessId);
        }

        let initInventoryQuery = supabase.from('inventory').select('*');
        if (userBusinessId) {
          initInventoryQuery = initInventoryQuery.eq('business_id', userBusinessId);
        }
        if (userBranchId) {
          initInventoryQuery = initInventoryQuery.eq('branch_id', userBranchId);
        }

        const [productsRes, inventoryRes] = await Promise.all([
           initProductsQuery,
           Promise.resolve(initInventoryQuery).catch(() => ({ data: [] }))
        ]);
        
        const initProducts = productsRes.data || [];
        const initInventory = inventoryRes.data || [];
        
        if (initProducts && initProducts.length > 0) {
          const processedProducts = initProducts.map(p => {
            const productInventory = initInventory.filter((i: any) => i.product_id === p.id && (!userBranchId || i.branch_id === userBranchId));
            const totalStock = productInventory.reduce((acc: number, cur: any) => acc + (cur.quantity || 0), 0);
            
            return {
              id: p.id,
              name: p.name || 'Unnamed',
              barcode: p.barcode || '',
              sku: p.sku || '',
              retailPrice: p.retail_price || p.retailPrice || 0,
              wholesalePrice: p.wholesale_price || p.wholesalePrice || 0,
              costPrice: p.cost_price || 0,
              taxClass: p.tax_class || p.taxClass || 'standard',
              category: p.category_id || p.category || 'all',
              imageUrl: '', 
              stock: totalStock,
              bundles: p.bundles
            };
          });
          setProducts(processedProducts);
          await saveLocalProducts(processedProducts);
        }
      } catch (err) {
        console.error('Core loading failed:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();

    return () => {
      if (unsubscribeProducts) unsubscribeProducts();
    };
  }, [activeSession?.id, activeSession?.branch_id]);

  return {
    products,
    setProducts,
    customers,
    setCustomers,
    categories,
    isLoading
  };
}
