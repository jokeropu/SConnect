const {ITEMS_PER_PAGE}=require('../config/appConfig');

const parsePaging=(query)=>{
    const page=Math.max(1,parseInt(query.page,10) || 1);
    const limit=Math.min(100,Math.max(1,parseInt(query.limit,10) || ITEMS_PER_PAGE));
    return {page,limit,skip:(page-1)*limit};
};

const buildMeta=(page,limit,total)=>({
    page,
    limit,
    total,
    totalPages:Math.max(1,Math.ceil(total/limit)),
    hasNext:page*limit<total,
    hasPrev:page>1
});

const searchRegex=(term)=>{
    if(!term) return null;
    const escaped=String(term).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    return new RegExp(escaped,'i');
};

module.exports={parsePaging,buildMeta,searchRegex};
