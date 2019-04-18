const fs = require('fs');
const Astronomy = require('../source/js/astronomy.js');

function LoadMoonPhaseData(filename) {
    // Load known moon phase times from US Naval Observatory.
    const text = fs.readFileSync(filename, {encoding:'utf8'});
    const lines = text.trimRight().split('\n');
    let data = [];
    for (let row of lines) {        
        let token = row.split(' ');
        data.push({quarter:parseInt(token[0]), date:new Date(token[1])});
    }
    return data;
}

function TestLongitudes(data) {
    // Using known moon phase times from US Naval Obs
    let max_arcmin = 0;
    for (let row of data) {
        let gm = Astronomy.GeoVector('Moon', row.date);
        const moon_eclip = Astronomy.Ecliptic(gm.x, gm.y, gm.z);

        let sun = Astronomy.GeoVector('Sun', row.date);
        const sun_eclip = Astronomy.Ecliptic(sun.x, sun.y, sun.z);

        let elong = moon_eclip.elon - sun_eclip.elon;
        if (elong < 0) elong += 360;
        let expected_elong = 90 * row.quarter;
        let degree_error = Math.abs(elong - expected_elong);
        if (degree_error > 180) degree_error = 360 - degree_error;
        let arcmin = 60 * degree_error;
        max_arcmin = Math.max(max_arcmin, arcmin);
        //console.log(`${row.quarter} ${row.date.toISOString()} ${elong} ${arcmin}`);
    }
    console.log(`TestLongitudes: nrows = ${data.length}, max_arcmin = ${max_arcmin}`);
    if (max_arcmin > 1.0) {
        console.log(`TestLongitudes: EXCESSIVE ANGULAR ERROR`);
        return 1;
    }
    return 0;
}

function SearchYear(year, data, index) {
    const millis_per_minute = 60*1000;
    const millis_per_day = 24*3600*1000;
    const threshold_minutes = 2;    // max tolerable prediction error in minutes
    let date = new Date(Date.UTC(year, 0, 1));
    let maxdiff = 0;
    let count = 0;
    while (index < data.length && data[index].date.getUTCFullYear() === year) {
        let mq = Astronomy.SearchMoonQuarter(date);

        // Verify that we found anything at all.
        if (!mq) {
            console.log(`SearchYear: could not find next moon quarter after ${date.toISOString()}`);
            return 1;
        }

        // Verify that we found the correct quarter.
        if (data[index].quarter !== mq.quarter) {
            console.log(`SearchYear: predicted quarter ${mq.quarter} but correct is ${data[index].quarter} for ${date.toISOString()}`);
            return 1;
        }

        // Verify that the date and time we found is very close to the correct answer.
        // Calculate the discrepancy in minutes.
        // This is appropriate because the "correct" answers are only given to the minute.
        let diff = (mq.time.date - data[index].date) / millis_per_minute;
        if (diff > threshold_minutes) {
            console.log(`SearchYear: EXCESSIVE ERROR = ${diff.toFixed(3)} minutes, correct=${data[index].date.toISOString()}, calculated=${mq.time.toString()}`);
            return 1;
        }
        maxdiff = Math.max(maxdiff, diff);

        // Skip one day past this moon quarter for next search.
        date = new Date(mq.time.date.getTime() + millis_per_day);
        ++index;
        ++count;
    }
    console.log(`SearchYear(${year}): count=${count}, maxdiff=${maxdiff.toFixed(3)}`);
    return 0;
}

function TestSearch(data) {
    // Search each year finding each quarter moon phase and confirm
    // they match up with the correct answers stored in the 'data' array.
    let index = 0;  // index into 'data' for the current year we are interested in.
    for (let year=1800; year <= 2100; year += 10) {
        while (data[index].date.getUTCFullYear() < year) ++index;
        let error = SearchYear(year, data, index);
        if (error) return error;
    }
    return 0;
}

function Statistics(data) {
    // Figure out mean, min, and max differences between various moon quarters.
    const stats = [null, null, null, null];
    let prev = null;
    for (let curr of data) {
        if (prev && curr.date.getUTCFullYear() === prev.date.getUTCFullYear()) {
            let dt = (curr.date - prev.date) / (24 * 3600 * 1000);
            let s = stats[prev.quarter];
            if (s) {
                s.min = Math.min(s.min, dt);
                s.max = Math.max(s.max, dt);
                s.sum += dt;
                ++s.count;
            } else {
                stats[prev.quarter] = {
                    min: dt,
                    max: dt,
                    sum: dt,
                    count: 1
                };
            }
        }
        prev = curr;
    }

    for (let q=0; q < 4; ++q) {
        let s = stats[q];
        if (s) {
            console.log(`Statistics: q=${q} min=${s.min.toFixed(3)} avg=${(s.sum/s.count).toFixed(3)} max=${s.max.toFixed(3)} span=${(s.max-s.min).toFixed(3)}`);
        }
    }
}

const TestData = LoadMoonPhaseData('moonphase/moonphases.txt');
Statistics(TestData);
process.exit(TestLongitudes(TestData) || TestSearch(TestData));