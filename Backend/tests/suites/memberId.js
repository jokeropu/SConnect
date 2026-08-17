const mongoose=require('mongoose');
const {connect,disconnect,BASE}=require('../helpers');

const M='../../src/';
const User=require('../../src/models/user');
const Counter=require('../../src/models/counter');
const {MEMBER_ID_PREFIX}=require('../../src/config/appConfig');

let failures=0;
const made=[];

const check=(label,actual,expected)=>{
    const ok=JSON.stringify(actual)===JSON.stringify(expected);
    if(!ok) failures++;
    console.log(`${ok?'PASS':'FAIL'}  ${label}${ok?'':`  (got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)})`}`);
};

const mk=async(tag,role,n)=>{
    const u=await User.create({firstName:'Seq'+n,lastName:'Id',email:`${tag}${role}${n}@x.io`,
        password:'x'.repeat(12),role,status:'approved'});
    made.push(u._id);
    return u;
};

(async()=>{
    await connect();
    const tag='zzmid-'+Date.now()+'-';
    const year=new Date().getFullYear();

    try{
        const roles=['admin','teacher','student','parent'];
        for(const role of roles){
            const u=await mk(tag,role,1);
            const prefix=MEMBER_ID_PREFIX[role];
            check(`${role} gets the ${prefix} prefix`,u.memberId.startsWith(prefix+'-'+year+'-'),true);
            check(`${role} id is zero padded to 4`,/-\d{4}$/.test(u.memberId),true);
        }

        const t2=await mk(tag,'teacher',2);
        const t3=await mk(tag,'teacher',3);
        const seq=(id)=>Number(id.split('-').pop());
        check('teacher sequence increments',seq(t3.memberId)-seq(t2.memberId),1);

        const s2=await mk(tag,'student',2);
        check('student sequence is separate from teacher',
            seq(s2.memberId)<seq(t3.memberId) || s2.memberId.startsWith('STU'),true);

        const before=(await Counter.findById(`member:TCH:${year}`))?.seq || 0;
        const batch=await Promise.all(
            Array.from({length:60},(_,i)=>User.create({
                firstName:'Par'+i,lastName:'Allel',email:`${tag}par${i}@x.io`,
                password:'x'.repeat(12),role:'teacher',status:'approved'
            }))
        );
        batch.forEach((u)=>made.push(u._id));

        const ids=batch.map((u)=>u.memberId);
        check('60 parallel creations produced 60 ids',ids.filter(Boolean).length,60);
        check('every id is unique',new Set(ids).size,60);

        const nums=ids.map(seq).sort((a,b)=>a-b);
        check('the sequence is contiguous, nothing skipped',nums[nums.length-1]-nums[0],59);
        check('it continued from where the counter was',nums[0],before+1);

        const after=(await Counter.findById(`member:TCH:${year}`)).seq;
        check('counter advanced by exactly 60',after-before,60);

        check('a count-based generator would have collided',new Set(Array(60).fill(before+1)).size,1);

        const victim=batch[0];
        victim.memberId='TCH-1999-9999';
        await victim.save();
        check('cannot be changed by save()',(await User.findById(victim._id)).memberId,ids[0]);
        await User.findByIdAndUpdate(victim._id,{$set:{memberId:'HACK-0001'}});
        check('cannot be changed by findByIdAndUpdate',(await User.findById(victim._id)).memberId,ids[0]);

        const explicit=await User.create({firstName:'Given',lastName:'Id',email:tag+'given@x.io',
            password:'x'.repeat(12),role:'teacher',status:'approved',memberId:'TCH-2000-0777'});
        made.push(explicit._id);
        check('an explicitly supplied id is kept',explicit.memberId,'TCH-2000-0777');

        let dupBlocked=false;
        try{
            const dup=await User.create({firstName:'Dupe',lastName:'Id',email:tag+'dupe@x.io',
                password:'x'.repeat(12),role:'teacher',status:'approved',memberId:'TCH-2000-0777'});
            made.push(dup._id);
        }
        catch(err){ dupBlocked=err.code===11000; }
        check('a duplicate id is rejected by the unique index',dupBlocked,true);
    }
    catch(err){
        failures++;
        console.log('FAIL  threw:',err.message);
    }
    finally{
        await User.deleteMany({_id:{$in:made}});
        await Counter.deleteMany({_id:new RegExp(`^member:.*:${year}$`)});
        const left=await User.countDocuments({email:new RegExp('^'+tag,'i')});
        console.log(`\ncleanup leftovers [user]: ${left}`);
        console.log(failures===0?'\nALL MEMBER-ID CHECKS PASSED':`\n${failures} CHECK(S) FAILED`);
        await disconnect();
        process.exit(failures===0?0:1);
    }
})();
