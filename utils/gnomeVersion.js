const Config = imports.misc.config; 

// '41.beta' => 41
// '41.4' => 41.4
// '3.38.beta' => 3.38
const GNOME_VERSION = parseFloat(Config.PACKAGE_VERSION);


function isLessThan42() {
    return GNOME_VERSION < 42;
}

function isLessThan43() {
    return GNOME_VERSION < 43;
}


