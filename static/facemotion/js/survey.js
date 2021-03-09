paper.install(window);

$(function() {
    // Setup directly from canvas id:
    paper.setup('face');

    $('#face').attr({
        width: $('#face').width(),
        height: $('#face').height()
    });

    face = new Face(me);
    face.showMuscles = 0;

    $('input.face-version').val(face.version);

    view.draw();

    view.onFrame = function(event) {
        face.loop(event);
    };

    setTimeout(function() {
        randomEmotion();
    }, 2000);

    $('form.survey').ajaxForm({
        'beforeSubmit': function() {
            $.each(face.muscles, function(muscle, val) {
                face.muscles[muscle] = 0;
            });
            $('input.query').attr('disabled', true);
        },
        'success': function() {
            $('input.query').val('');
            setTimeout(function() {
                randomEmotion();
            }, 1000);
            $('input.query').removeAttr('disabled');
        }
    });
});

function randomEmotion(n) {
    var emotions = {};

    // Do this for one or two muscles
    if (typeof n === "undefined") {
        if (randInt(0,5) == 0) {
            n = 1;
        } else {
            n = 2;
        }
        console.log(n);
    }

    $.each(face.recipes, function(emotion, muscles) {
        emotions[emotion] = 0;
    });

    $('input.name-0').val('');
    $('input.val-0').val('');
    $('input.name-1').val('');
    $('input.val-1').val('');

    for (var i = 0; i < n; i++) {
        var selectedEmotion = randomChoice(Object.keys(face.recipes));

        while (emotions[selectedEmotion] != 0) {
            selectedEmotion = randomChoice(Object.keys(face.recipes));
        }

        emotions[selectedEmotion] = random(.3, 1);

        $('input.name-' + i).val(selectedEmotion);
        $('input.val-' + i).val(emotions[selectedEmotion]);

        musclePulls = face.recalculateMusclesFromEmotions(emotions);

        $.each(musclePulls, function(muscle, pull) {
            face.muscles[muscle] = pull;
        });

        console.log(selectedEmotion + ' at ' + emotions[selectedEmotion]);
    }
}