// Constructor
function Queue(bar) {
  this.queue = {};
  this.toSend = {};
  this.database = null;
  this.buffer = 50;
  this.collection = '';
  this.updating = false;
}
// initialize method
Queue.prototype.init = function(database, buffer, collection) {
  this.database = database;
  this.buffer = buffer;
  this.collection = collection;
}
// show current
Queue.prototype.showCurrent = function(queue, databaseInstance, uploadingToDatabase) {
  console.log('queue: ', this.queue);
}
// add message
Queue.prototype.addMessage = function(key, value) {
  if(!this.queue[key]) this.queue[key] = [];
  this.queue[key].push( value );
}
// get current data
Queue.prototype.getMessages = function(key) {
  if(!this.queue[key]) this.queue[key] = [];
  return this.queue[key];
}

Queue.prototype.getMessagesDB = function(key, callback) {
  console.log('db request', key);
  this.database.collection(this.collection)
  this.database.collection(this.collection).find({})
    .project({ [key]: 1 })
    .toArray((err, data) => {
      if (err) return callback([]);
      return callback(data[0] !== undefined ? data[0][key] : [] );
    });
  
}
Queue.prototype.updateRec = function(loc, callback) {
  let key = Object.keys(this.toSend)[loc];
  if(key === undefined) return callback();
  console.log('updating box',key);
  this.database.collection(this.collection).update(
    {},
    { $addToSet: {  [key]: { $each: this.toSend[key] } } },
    {upsert: true},
    (err, data) => {
      if(err) {
        setTimeout( () => this.updateRec(loc, callback), 1000 );
        console.log(err);
      } else {
        this.updateRec(loc+1,callback);
      }
    }
  )
}

// run this regularly
Queue.prototype.sync = function() {
  // checking all messages of a nested object is a bad idea, let db driver take care of duplicate messages
  if (this.updating == false) {
    if (JSON.stringify(this.toSend) === JSON.stringify(this.queue)){ 
      return;
    }
    this.toSend = JSON.parse(JSON.stringify(this.queue));
    this.updating = true;
    this.updateRec(0,()=>{
      console.log('done updating');
      this.updating = false;
    } );
  }
}

module.exports = new Queue();