/**
 * @license
 * Copyright 2016 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */


describe('SimpleTextDisplayer', function() {
  /** @const */
  var originalVTTCue = window.VTTCue;
  /** @const */
  var Cue = shaka.text.Cue;
  /** @const */
  var SimpleTextDisplayer = shaka.text.SimpleTextDisplayer;
  /** @type {!shaka.test.FakeVideo} */
  var video;
  /** @type {!shaka.test.FakeTextTrack} */
  var mockTrack;
  /** @type {!shaka.text.SimpleTextDisplayer} */
  var displayer;
  /** @type {shaka.text.Cue} */
  var cue1;
  /** @type {shaka.text.Cue} */
  var cue2;
  /** @type {shaka.text.Cue} */
  var cue3;

  beforeEach(function() {
    video = new shaka.test.FakeVideo();
    displayer = new SimpleTextDisplayer(video);

    expect(video.textTracks.length).toBe(1);
    mockTrack = /** @type {!shaka.test.FakeTextTrack} */ (video.textTracks[0]);
    expect(mockTrack).toBeTruthy();

    window.VTTCue = function(start, end, text) {
      this.startTime = start;
      this.endTime = end;
      this.text = text;
    };
  });

  afterAll(function() {
    window.VTTCue = originalVTTCue;
  });

  describe('remove', function() {
    it('removes cues which overlap the range', function() {
      cue1 = new shaka.text.Cue(0, 1, 'Test');
      cue2 = new shaka.text.Cue(1, 2, 'Test');
      cue3 = new shaka.text.Cue(2, 3, 'Test');
      displayer.append([cue1, cue2, cue3]);

      displayer.remove(0, 1);
      expect(mockTrack.removeCue.calls.count()).toBe(1);
      expect(mockTrack.removeCue).toHaveBeenCalledWith(
          jasmine.objectContaining({startTime: 0, endTime: 1}));
      mockTrack.removeCue.calls.reset();

      displayer.remove(0.5, 1.001);
      expect(mockTrack.removeCue.calls.count()).toBe(1);
      expect(mockTrack.removeCue).toHaveBeenCalledWith(
          jasmine.objectContaining({startTime: 1, endTime: 2}));
      mockTrack.removeCue.calls.reset();

      displayer.remove(3, 5);
      expect(mockTrack.removeCue).not.toHaveBeenCalled();
      mockTrack.removeCue.calls.reset();

      displayer.remove(2.9999, Infinity);
      expect(mockTrack.removeCue.calls.count()).toBe(1);
      expect(mockTrack.removeCue).toHaveBeenCalledWith(
          jasmine.objectContaining({startTime: 2, endTime: 3}));
      mockTrack.removeCue.calls.reset();
    });

    it('does nothing when nothing is buffered', function() {
      displayer.remove(0, 1);
      expect(mockTrack.removeCue).not.toHaveBeenCalled();
    });
  });

  describe('convertToTextTrackCue', function() {
    it('converts shaka.text.Cues to VttCues', function() {
      verifyHelper(
          [
            {start: 20, end: 40, text: 'Test'}
          ],
          [
            new shaka.text.Cue(20, 40, 'Test')
          ]);

      cue1 = new shaka.text.Cue(20, 40, 'Test');
      cue1.positionAlign = Cue.positionAlign.LEFT;
      cue1.lineAlign = Cue.lineAlign.START;
      cue1.size = 80;
      cue1.textAlign = Cue.textAlign.LEFT;
      cue1.writingDirection = Cue.writingDirection.VERTICAL_LEFT;
      cue1.lineInterpretation = Cue.lineInterpretation.LINE_NUMBER;
      cue1.line = 5;
      cue1.position = 10;

      cue2 = new shaka.text.Cue(20, 40, 'Test');
      cue2.positionAlign = Cue.positionAlign.RIGHT;
      cue2.lineAlign = Cue.lineAlign.END;
      cue2.textAlign = Cue.textAlign.RIGHT;
      cue2.writingDirection = Cue.writingDirection.VERTICAL_RIGHT;
      cue2.lineInterpretation = Cue.lineInterpretation.PERCENTAGE;
      cue2.line = 5;

      cue3 = new shaka.text.Cue(20, 40, 'Test');
      cue3.positionAlign = Cue.positionAlign.CENTER;
      cue3.lineAlign = Cue.lineAlign.CENTER;
      cue3.textAlign = Cue.textAlign.START;
      cue3.writingDirection = Cue.writingDirection.HORIZONTAL;

      verifyHelper(
          [
            {
              start: 20,
              end: 40,
              text: 'Test',
              lineAlign: 'start',
              positionAlign: 'line-left',
              size: 80,
              align: 'left',
              vertical: 'lr',
              snapToLines: true,
              line: 5,
              position: 10
            },
            {
              start: 20,
              end: 40,
              text: 'Test',
              lineAlign: 'end',
              positionAlign: 'line-right',
              align: 'right',
              vertical: 'rl',
              snapToLines: false,
              line: 5
            },
            {
              start: 20,
              end: 40,
              text: 'Test',
              lineAlign: 'center',
              positionAlign: 'center',
              align: 'start',
              vertical: undefined
            }
          ],
          [cue1, cue2, cue3]);
    });

    it('uses a workaround for browsers not supporting align=center',
        function() {
          window.VTTCue = function(start, end, text) {
            var align = 'middle';
            Object.defineProperty(this, 'align', {
              get: function() { return align; },
              set: function(newValue) {
                if (newValue != 'center') align = newValue;
              }
            });
            this.startTime = start;
            this.endTime = end;
            this.text = text;
          };

          cue1 = new shaka.text.Cue(20, 40, 'Test');
          cue1.textAlign = Cue.textAlign.CENTER;

          verifyHelper(
              [
                {
                  start: 20,
                  end: 40,
                  text: 'Test',
                  align: 'middle'
                }
              ],
              [cue1]);
        });

    it('ignores cues with startTime >= endTime', function() {
      cue1 = new shaka.text.Cue(60, 40, 'Test');
      cue2 = new shaka.text.Cue(40, 40, 'Test');
      displayer.append([cue1, cue2]);
      expect(mockTrack.addCue).not.toHaveBeenCalled();
    });
  });


  function createFakeCue(startTime, endTime) {
    return { startTime: startTime, endTime: endTime };
  }

  /**
   * @param {!Array} vttCues
   * @param {!Array.<!shaka.text.Cue>} shakaCues
   */
  function verifyHelper(vttCues, shakaCues) {
    mockTrack.addCue.calls.reset();
    displayer.append(shakaCues);
    var result = mockTrack.addCue.calls.allArgs().reduce(
        shaka.util.Functional.collapseArrays, []);
    expect(result).toBeTruthy();
    expect(result.length).toBe(vttCues.length);
    for (var i = 0; i < vttCues.length; i++) {
      expect(result[i].startTime).toBe(vttCues[i].start);
      expect(result[i].endTime).toBe(vttCues[i].end);
      expect(result[i].text).toBe(vttCues[i].text);

      if (vttCues[i].id)
        expect(result[i].id).toBe(vttCues[i].id);
      if (vttCues[i].vertical)
        expect(result[i].vertical).toBe(vttCues[i].vertical);
      if (vttCues[i].line)
        expect(result[i].line).toBe(vttCues[i].line);
      if (vttCues[i].align)
        expect(result[i].align).toBe(vttCues[i].align);
      if (vttCues[i].size)
        expect(result[i].size).toBe(vttCues[i].size);
      if (vttCues[i].position)
        expect(result[i].position).toBe(vttCues[i].position);
    }
  }
});
