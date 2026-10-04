// Fault injection is confined to this test entry, never a production query flag.
import '../../src/processing/separation.worker';
Object.defineProperty(navigator,'gpu',{value:undefined});
